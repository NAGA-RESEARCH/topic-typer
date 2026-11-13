import json
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotAllowed
from django.views.decorators.http import require_http_methods
from django.db import transaction, models
from .models import TypingSession, KeyStat, CachedTopic
from .services import fetch_wikipedia_summary, fetch_random_wikipedia_summary


# ============================================================================
# 1. HTML PAGE VIEWS
# ============================================================================

def home_view(request):
    """Renders the TopicTyper homepage with mode selection & live analytics."""
    return render(request, 'typer/index.html')


def practice_view(request):
    """Renders the distraction-free typing arena."""
    return render(request, 'typer/practice.html')


def about_view(request):
    """Renders the About and Naga Research Lab overview page."""
    return render(request, 'typer/about.html')


# ============================================================================
# 2. REST API ENDPOINTS
# ============================================================================

def api_topic(request):
    """
    GET /api/topic/?q=<query>
    Checks CachedTopic first (case-insensitive); if not cached, fetches
    from Wikipedia REST API, sanitizes text, caches in SQLite, and returns JSON.
    """
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'error': 'Query parameter q is required.'}, status=400)

    # Check SQLite cache first
    cached = CachedTopic.objects.filter(title__iexact=query).first()
    if cached:
        return JsonResponse({
            'title': cached.title,
            'description': cached.description,
            'extract': cached.summary_text,
            'source_url': cached.source_url,
            'cached': True,
        })

    # Fetch from Wikipedia & sanitize
    data = fetch_wikipedia_summary(query)
    title = data.get('title') or query
    description = data.get('description', '')
    extract = data.get('extract', '')
    source_url = data.get('source_url', '')

    # Cache in SQLite
    CachedTopic.objects.update_or_create(
        title=title,
        defaults={
            'description': description[:500],
            'summary_text': extract,
            'source_url': source_url[:500],
        }
    )

    return JsonResponse({
        'title': title,
        'description': description,
        'extract': extract,
        'source_url': source_url,
        'cached': False,
    })


def api_random_topic(request):
    """
    GET /api/topic/random/
    Fetches a random Wikipedia summary, sanitizes it, caches it in SQLite, and returns JSON.
    """
    data = fetch_random_wikipedia_summary()
    title = data.get('title') or 'Random Topic'
    description = data.get('description', '')
    extract = data.get('extract', '')
    source_url = data.get('source_url', '')

    CachedTopic.objects.update_or_create(
        title=title,
        defaults={
            'description': description[:500],
            'summary_text': extract,
            'source_url': source_url[:500],
        }
    )

    return JsonResponse({
        'title': title,
        'description': description,
        'extract': extract,
        'source_url': source_url,
        'cached': False,
    })


@require_http_methods(["POST"])
def api_save_session(request):
    """
    POST /api/session/save/
    Validates CSRF, parses JSON payload containing session metrics and key_stats,
    creates a TypingSession row, and atomically increments KeyStat records in SQLite.
    """
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest(json.dumps({'error': 'Invalid JSON body'}), content_type='application/json')

    topic_title = payload.get('topic_title', 'Unknown Topic')[:255]
    mode = payload.get('mode', 'paragraph')
    if mode not in ['paragraph', 'timed', 'drill', 'custom', 'code']:
        mode = 'paragraph'

    try:
        duration_seconds = int(payload.get('duration_seconds', 0))
    except (ValueError, TypeError):
        duration_seconds = 0

    try:
        wpm = float(payload.get('wpm', 0.0))
        raw_wpm = float(payload.get('raw_wpm', 0.0))
        accuracy = float(payload.get('accuracy', 100.0))
        errors_count = int(payload.get('errors_count', 0))
        characters_typed = int(payload.get('characters_typed', 0))
    except (ValueError, TypeError):
        wpm = 0.0
        raw_wpm = 0.0
        accuracy = 100.0
        errors_count = 0
        characters_typed = 0

    key_stats = payload.get('key_stats', {})

    with transaction.atomic():
        # Create TypingSession record
        session = TypingSession.objects.create(
            topic_title=topic_title,
            mode=mode,
            duration_seconds=duration_seconds,
            wpm=round(wpm, 1),
            raw_wpm=round(raw_wpm, 1),
            accuracy=round(accuracy, 1),
            errors_count=errors_count,
            characters_typed=characters_typed,
        )

        # Atomically increment KeyStat records
        if isinstance(key_stats, dict):
            for char_key, stats in key_stats.items():
                if not char_key or len(char_key) > 5:
                    continue
                attempts = 0
                errors = 0
                if isinstance(stats, dict):
                    attempts = int(stats.get('attempts', 0) or 0)
                    errors = int(stats.get('errors', 0) or 0)
                elif isinstance(stats, (list, tuple)) and len(stats) >= 2:
                    attempts = int(stats[0] or 0)
                    errors = int(stats[1] or 0)

                if attempts > 0 or errors > 0:
                    ks, _ = KeyStat.objects.get_or_create(character=char_key)
                    KeyStat.objects.filter(pk=ks.pk).update(
                        total_attempts=models.F('total_attempts') + attempts,
                        error_count=models.F('error_count') + errors,
                    )

    return JsonResponse({
        'status': 'ok',
        'session_id': session.id,
        'wpm': session.wpm,
        'accuracy': session.accuracy,
    })


def api_analytics(request):
    """
    GET /api/analytics/
    Returns JSON with the last 15 TypingSession records (ordered oldest-to-newest
    for WPM progress charting) and top weak keys from KeyStat.
    """
    recent_sessions_qs = TypingSession.objects.order_by('-created_at')[:15]
    sessions_list = []
    for s in reversed(list(recent_sessions_qs)):
        sessions_list.append({
            'id': s.id,
            'topic': s.topic_title,
            'mode': s.mode,
            'wpm': s.wpm,
            'raw_wpm': s.raw_wpm,
            'accuracy': s.accuracy,
            'errors': s.errors_count,
            'characters': s.characters_typed,
            'duration': s.duration_seconds,
            'date': s.created_at.strftime('%b %d, %H:%M'),
            'timestamp': int(s.created_at.timestamp() * 1000),
        })

    # Weak Keys (total_attempts >= 5, sorted by error percentage descending)
    qualified_keys = KeyStat.objects.filter(total_attempts__gte=5)
    key_list = []
    for k in qualified_keys:
        key_list.append({
            'character': k.character,
            'displayKey': 'Space' if k.character == ' ' else k.character,
            'attempts': k.total_attempts,
            'errors': k.error_count,
            'errorRate': k.error_rate,
        })

    key_list.sort(key=lambda x: x['errorRate'], reverse=True)
    top_weak = key_list[:5]

    # Full dictionary for QWERTY heatmap
    all_keys = {}
    for k in KeyStat.objects.all():
        all_keys[k.character] = {
            'attempts': k.total_attempts,
            'errors': k.error_count,
            'errorRate': k.error_rate,
        }

    # All-time Personal Best (PB) WPM
    best_session = TypingSession.objects.order_by('-wpm').first()
    personal_best_wpm = round(best_session.wpm, 1) if best_session else 0

    # Consecutive Daily Practice Streak
    import datetime
    from django.utils import timezone
    all_dates = set(TypingSession.objects.dates('created_at', 'day'))
    today = timezone.localdate()
    yesterday = today - datetime.timedelta(days=1)
    daily_streak = 0
    if today in all_dates:
        daily_streak = 1
        check_date = today - datetime.timedelta(days=1)
        while check_date in all_dates:
            daily_streak += 1
            check_date -= datetime.timedelta(days=1)
    elif yesterday in all_dates:
        daily_streak = 1
        check_date = yesterday - datetime.timedelta(days=1)
        while check_date in all_dates:
            daily_streak += 1
            check_date -= datetime.timedelta(days=1)

    return JsonResponse({
        'sessions': sessions_list,
        'top_weak_keys': top_weak,
        'all_key_stats': all_keys,
        'total_sessions': TypingSession.objects.count(),
        'personal_best_wpm': personal_best_wpm,
        'daily_streak': daily_streak,
    })
