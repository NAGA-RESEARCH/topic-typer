import json
import datetime
import urllib.parse
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotAllowed
from django.views.decorators.http import require_http_methods
from django.db import transaction, models
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.utils import timezone

from .models import (
    TypingSession, KeyStat, CachedTopic, UserProfile,
    CuratedTopic, CodeSnippet, PracticeDrill, CommunityPost, CommunityComment
)
from .services import fetch_wikipedia_summary, fetch_random_wikipedia_summary
from .code_library import CODE_SNIPPETS, SPECIALIZED_DRILLS, get_all_snippets, get_snippets_by_language
from .recommendations import get_personalized_recommendations
from .seeder import seed_all_if_needed


# ============================================================================
# 1. HTML PAGE VIEWS
# ============================================================================

def home_view(request):
    """
    Renders the TopicTyper homepage with Wikipedia topic typing hero first,
    guest mode for core practice, and auth-protected secondary entry points.
    """
    seed_all_if_needed()
    recommendations = None
    if request.user.is_authenticated:
        recommendations = get_personalized_recommendations(request.user)

    curated_topics = list(CuratedTopic.objects.filter(is_active=True).order_by('order')[:12])
    drills = list(PracticeDrill.objects.all().order_by('order'))

    context = {
        'recommendations': recommendations,
        'curated_topics': curated_topics,
        'specialized_drills': drills,
        'code_snippets_count': CodeSnippet.objects.count() or len(get_all_snippets()),
    }
    return render(request, 'typer/index.html', context)


@login_required(login_url='login')
def code_arena_view(request):
    """
    Renders the dedicated IDE-style Code Arena practice interface (/code/).
    Protected by authentication.
    """
    languages = [
        {'id': 'python', 'name': 'Python', 'icon': 'python'},
        {'id': 'cpp', 'name': 'C++', 'icon': 'cpp'},
        {'id': 'javascript', 'name': 'JavaScript', 'icon': 'javascript'},
        {'id': 'sql', 'name': 'SQL', 'icon': 'database'},
        {'id': 'bash', 'name': 'Linux / Bash', 'icon': 'terminal'},
        {'id': 'html_css', 'name': 'HTML / CSS', 'icon': 'globe'},
    ]

    difficulties = ['All', 'Beginner', 'Intermediate', 'DSA & Algorithms']

    # User preferences if authenticated
    user_fav_langs = []
    if request.user.is_authenticated:
        profile = getattr(request.user, 'profile', None)
        if profile:
            user_fav_langs = profile.get_languages_list()

    # Load from DB or fallback
    snippets_from_db = {}
    for lang_code in ['python', 'cpp', 'javascript', 'sql', 'bash', 'html_css']:
        items = list(CodeSnippet.objects.filter(language=lang_code).values(
            'snippet_id', 'title', 'filename', 'language', 'difficulty', 'icon', 'description', 'code'
        ))
        if items:
            snippets_from_db[lang_code] = [{
                'id': s['snippet_id'],
                'title': s['title'],
                'filename': s['filename'],
                'lang': s['language'],
                'difficulty': s['difficulty'],
                'icon': s['icon'],
                'description': s['description'],
                'code': s['code'],
            } for s in items]
        else:
            snippets_from_db[lang_code] = CODE_SNIPPETS.get(lang_code, [])

    context = {
        'languages': languages,
        'difficulties': difficulties,
        'code_snippets_json': json.dumps(snippets_from_db),
        'user_fav_langs': user_fav_langs,
        'initial_lang': user_fav_langs[0] if user_fav_langs and user_fav_langs[0] in snippets_from_db else 'python',
    }
    return render(request, 'typer/code_arena.html', context)


def practice_view(request):
    """
    Renders the distraction-free typing arena.
    Wikipedia topic practice is open to guests.
    Secondary modes (code, drill, custom) require authentication.
    """
    mode = request.GET.get('mode', 'paragraph')
    if mode in ['code', 'drill', 'custom'] and not request.user.is_authenticated:
        return redirect(f"/login/?next={request.get_full_path()}")

    return render(request, 'typer/practice.html')


def about_view(request):
    """Renders the About and Naga Research Lab overview page."""
    return render(request, 'typer/about.html')


@login_required(login_url='login')
def profile_view(request):
    """
    Renders the dedicated User Profile Dashboard (/profile/).
    Protected by authentication.
    Zero emojis — all 100% vector iconography.
    """
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    saved_success = False

    available_languages = [
        {'id': 'python', 'name': 'Python', 'icon': 'python'},
        {'id': 'javascript', 'name': 'JavaScript', 'icon': 'javascript'},
        {'id': 'cpp', 'name': 'C++', 'icon': 'cpp'},
        {'id': 'sql', 'name': 'SQL', 'icon': 'database'},
        {'id': 'bash', 'name': 'Linux / Bash', 'icon': 'terminal'},
        {'id': 'html_css', 'name': 'HTML / CSS', 'icon': 'globe'},
    ]

    if request.method == 'POST':
        skill_level = request.POST.get('skill_level', 'Beginner')
        langs = request.POST.getlist('languages')
        if skill_level in ['Beginner', 'Intermediate', 'Pro']:
            profile.skill_level = skill_level
        if langs:
            profile.favorite_languages = ','.join(langs)
        profile.save()
        saved_success = True

    # Lifetime Telemetry
    sessions_qs = TypingSession.objects.filter(user=request.user)
    total_sessions = sessions_qs.count()
    best_wpm = round(sessions_qs.aggregate(models.Max('wpm'))['wpm__max'] or 0.0, 1)
    avg_accuracy = round(sessions_qs.aggregate(models.Avg('accuracy'))['accuracy__avg'] or 100.0, 1)
    total_chars = sessions_qs.aggregate(models.Sum('characters_typed'))['characters_typed__sum'] or 0
    total_duration_sec = sessions_qs.aggregate(models.Sum('duration_seconds'))['duration_seconds__sum'] or 0
    total_practice_minutes = round(total_duration_sec / 60, 1)

    # Active Daily Practice Streak
    all_dates = set(sessions_qs.dates('created_at', 'day'))
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

    # Skill Rank
    if best_wpm >= 100:
        skill_rank = {'title': 'Hyperspeed Grandmaster', 'badge': 'crown', 'class': 'rank-grandmaster', 'tier': 'Tier 5'}
    elif best_wpm >= 70:
        skill_rank = {'title': 'Keystream Prodigy', 'badge': 'gem', 'class': 'rank-prodigy', 'tier': 'Tier 4'}
    elif best_wpm >= 50:
        skill_rank = {'title': 'Flow Artisan', 'badge': 'bolt', 'class': 'rank-artisan', 'tier': 'Tier 3'}
    elif best_wpm >= 30:
        skill_rank = {'title': 'Intermediate Scribe', 'badge': 'award', 'class': 'rank-scribe', 'tier': 'Tier 2'}
    else:
        skill_rank = {'title': 'Novice Typist', 'badge': 'star', 'class': 'rank-novice', 'tier': 'Tier 1'}

    # Language & Mode Breakdown
    breakdown_data = []
    mode_definitions = [
        {'id': 'paragraph', 'name': 'Paragraph Mode', 'icon': 'book'},
        {'id': 'timed', 'name': 'Timed Sprint', 'icon': 'timer'},
        {'id': 'drill', 'name': 'Weak Keys Drill', 'icon': 'target'},
        {'id': 'code_python', 'name': 'Python (Code)', 'icon': 'python', 'is_code_lang': 'python'},
        {'id': 'code_js', 'name': 'JavaScript (Code)', 'icon': 'javascript', 'is_code_lang': 'javascript'},
        {'id': 'code_cpp', 'name': 'C++ (Code)', 'icon': 'cpp', 'is_code_lang': 'cpp'},
        {'id': 'code_other', 'name': 'Other Code Arenas', 'icon': 'code', 'is_code_other': True},
    ]

    for item in mode_definitions:
        if 'is_code_lang' in item:
            lang_key = item['is_code_lang']
            qs = sessions_qs.filter(mode='code').filter(
                models.Q(topic_title__icontains=lang_key) | 
                models.Q(topic_title__icontains=f".{lang_key[:2]}")
            )
        elif item.get('is_code_other'):
            qs = sessions_qs.filter(mode='code').exclude(
                models.Q(topic_title__icontains='python') | 
                models.Q(topic_title__icontains='javascript') | 
                models.Q(topic_title__icontains='cpp') | 
                models.Q(topic_title__icontains='c++')
            )
        else:
            qs = sessions_qs.filter(mode=item['id'])

        c = qs.count()
        if c > 0:
            m_avg_wpm = round(qs.aggregate(models.Avg('wpm'))['wpm__avg'] or 0.0, 1)
            m_best_wpm = round(qs.aggregate(models.Max('wpm'))['wpm__max'] or 0.0, 1)
            m_acc = round(qs.aggregate(models.Avg('accuracy'))['accuracy__avg'] or 100.0, 1)
            breakdown_data.append({
                'name': item['name'],
                'icon': item['icon'],
                'sessions_count': c,
                'avg_wpm': m_avg_wpm,
                'best_wpm': m_best_wpm,
                'accuracy': m_acc,
                'wpm_percent': min(100, int((m_avg_wpm / 120.0) * 100)),
                'acc_percent': min(100, int(m_acc)),
            })

    if not breakdown_data:
        breakdown_data = [
            {'name': 'Paragraph Mode', 'icon': 'book', 'sessions_count': 0, 'avg_wpm': 0.0, 'best_wpm': 0.0, 'accuracy': 100.0, 'wpm_percent': 0, 'acc_percent': 100},
            {'name': 'Python (Code)', 'icon': 'python', 'sessions_count': 0, 'avg_wpm': 0.0, 'best_wpm': 0.0, 'accuracy': 100.0, 'wpm_percent': 0, 'acc_percent': 100},
        ]

    # Unlockable Achievement Badges
    code_sessions_count = sessions_qs.filter(mode='code').count()
    has_98_acc = sessions_qs.filter(accuracy__gte=98.0).exists()
    has_100_acc = sessions_qs.filter(accuracy=100.0).exists()

    achievements = [
        {
            'id': 'first_keystroke',
            'title': 'First Keystroke',
            'icon': 'keyboard',
            'description': 'Completed your first typing session on TopicTyper',
            'unlocked': total_sessions >= 1,
            'metric': f"{total_sessions}/1 session",
        },
        {
            'id': 'flow_state',
            'title': 'Flow State 50+ WPM',
            'icon': 'pulse',
            'description': 'Maintained a speed of 50+ WPM in any typing session',
            'unlocked': best_wpm >= 50,
            'metric': f"Best: {best_wpm} WPM",
        },
        {
            'id': 'syntax_surgeon',
            'title': 'Syntax Surgeon 98% Acc',
            'icon': 'target',
            'description': 'Achieved 98%+ precision on a full practice run',
            'unlocked': has_98_acc,
            'metric': '98%+ Precision',
        },
        {
            'id': 'streak_builder',
            'title': 'Streak Builder',
            'icon': 'flame',
            'description': 'Practiced consistently for 3 or more consecutive days',
            'unlocked': daily_streak >= 3,
            'metric': f"{daily_streak}/3 days",
        },
        {
            'id': 'speed_demon',
            'title': 'Velocity Demon 80+ WPM',
            'icon': 'bolt',
            'description': 'Surpassed 80 WPM in developer or paragraph arena',
            'unlocked': best_wpm >= 80,
            'metric': f"Best: {best_wpm} WPM",
        },
        {
            'id': 'centurion_century',
            'title': 'Triple Digit 100+ WPM',
            'icon': 'crown',
            'description': 'Entered the elite 100+ WPM hyperspeed tier',
            'unlocked': best_wpm >= 100,
            'metric': f"Best: {best_wpm} WPM",
        },
        {
            'id': 'flawless_gem',
            'title': 'Flawless 100% Accuracy',
            'icon': 'gem',
            'description': 'Completed a run with flawless 100% accuracy and zero typos',
            'unlocked': has_100_acc,
            'metric': '100% Run',
        },
        {
            'id': 'code_artisan',
            'title': 'Code Polyglot',
            'icon': 'code',
            'description': 'Completed 5+ code sessions in the developer arena',
            'unlocked': code_sessions_count >= 5,
            'metric': f"{code_sessions_count}/5 code runs",
        },
        {
            'id': 'century_typer',
            'title': '10,000 Keystrokes',
            'icon': 'book',
            'description': 'Typed over 10,000 characters lifetime',
            'unlocked': total_chars >= 10000,
            'metric': f"{total_chars:,} chars",
        },
    ]

    context = {
        'profile': profile,
        'user_fav_langs': profile.get_languages_list(),
        'available_languages': available_languages,
        'saved_success': saved_success,
        'total_sessions': total_sessions,
        'best_wpm': best_wpm,
        'avg_accuracy': avg_accuracy,
        'total_chars': total_chars,
        'total_practice_minutes': total_practice_minutes,
        'daily_streak': daily_streak,
        'skill_rank': skill_rank,
        'breakdown_data': breakdown_data,
        'achievements': achievements,
        'unlocked_count': sum(1 for a in achievements if a['unlocked']),
        'total_achievements': len(achievements),
    }
    return render(request, 'typer/profile.html', context)


# ============================================================================
# 2. COMMUNITY DISCUSSION & FEEDBACK HUB VIEWS
# ============================================================================

def community_view(request):
    """
    Renders the Community Discussion & Feedback Hub (/community/).
    Open for anyone to read. Filter by category.
    """
    seed_all_if_needed()
    category = request.GET.get('category', 'All').strip()
    categories = ['All', 'Feature Idea', 'Bug Report', 'Topic Request', 'General']

    posts_qs = CommunityPost.objects.select_related('user').prefetch_related('comments__user', 'upvotes')
    if category and category != 'All':
        posts_qs = posts_qs.filter(category=category)

    posts = list(posts_qs.order_by('-created_at'))

    user = request.user if request.user.is_authenticated else None
    enhanced_posts = []
    for post in posts:
        is_upvoted = user in post.upvotes.all() if user else False
        enhanced_posts.append({
            'id': post.id,
            'title': post.title,
            'category': post.category,
            'body': post.body,
            'user': post.user,
            'created_at': post.created_at,
            'upvote_count': post.upvotes.count(),
            'is_upvoted': is_upvoted,
            'comments': list(post.comments.all().order_by('created_at')),
            'comment_count': post.comments.count(),
        })

    context = {
        'posts': enhanced_posts,
        'categories': categories,
        'selected_category': category,
        'posts_count': len(enhanced_posts),
        'total_posts_count': CommunityPost.objects.count(),
    }
    return render(request, 'typer/community.html', context)


@login_required(login_url='login')
@require_http_methods(['POST'])
def community_post_create(request):
    """Creates a new community discussion post."""
    title = request.POST.get('title', '').strip()
    category = request.POST.get('category', 'General').strip()
    body = request.POST.get('body', '').strip()

    valid_cats = ['Feature Idea', 'Bug Report', 'Topic Request', 'General']
    if category not in valid_cats:
        category = 'General'

    if not title or not body:
        return HttpResponseBadRequest("Title and body are required.")

    post = CommunityPost.objects.create(
        user=request.user,
        category=category,
        title=title[:255],
        body=body
    )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({
            'success': True,
            'post_id': post.id,
            'title': post.title,
            'category': post.category,
        })
    return redirect('community')


@login_required(login_url='login')
@require_http_methods(['POST'])
def community_post_upvote(request, post_id):
    """Toggles upvote for a community post."""
    post = get_object_or_404(CommunityPost, id=post_id)

    if request.user in post.upvotes.all():
        post.upvotes.remove(request.user)
        upvoted = False
    else:
        post.upvotes.add(request.user)
        upvoted = True

    return JsonResponse({
        'success': True,
        'upvoted': upvoted,
        'upvote_count': post.upvotes.count(),
    })


@login_required(login_url='login')
@require_http_methods(['POST'])
def community_comment_create(request, post_id):
    """Adds a reply/comment to a community post."""
    post = get_object_or_404(CommunityPost, id=post_id)

    body = request.POST.get('body', '').strip()
    if not body:
        return HttpResponseBadRequest("Comment body cannot be empty.")

    comment = CommunityComment.objects.create(
        post=post,
        user=request.user,
        body=body
    )

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({
            'success': True,
            'comment_id': comment.id,
            'author': request.user.username,
            'body': comment.body,
            'created_at': comment.created_at.strftime('%b %d, %Y %H:%M'),
        })
    return redirect('community')


# ============================================================================
# 2. USER AUTHENTICATION VIEWS
# ============================================================================

def signup_view(request):
    """
    Handles user registration with custom preferences:
    - Favorite programming languages (Python, C++, JS, SQL, Bash, HTML/CSS)
    - Skill level (Beginner, Intermediate, Pro)
    Styled with the active CSS theme variables.
    """
    if request.user.is_authenticated:
        return redirect('home')

    error_message = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirm_password', '')
        skill_level = request.POST.get('skill_level', 'Beginner')
        languages = request.POST.getlist('languages')

        if not username or not password:
            error_message = "Username and password are required."
        elif len(username) < 3:
            error_message = "Username must be at least 3 characters long."
        elif password != confirm_password:
            error_message = "Passwords do not match."
        elif len(password) < 6:
            error_message = "Password must be at least 6 characters long."
        elif User.objects.filter(username__iexact=username).exists():
            error_message = f"Username '{username}' is already taken."
        else:
            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password=password
                    )
                    fav_langs_str = ','.join(languages) if languages else 'python,javascript'
                    UserProfile.objects.create(
                        user=user,
                        skill_level=skill_level if skill_level in ['Beginner', 'Intermediate', 'Pro'] else 'Beginner',
                        favorite_languages=fav_langs_str
                    )
                # Log the user in
                login(request, user)
                return redirect('home')
            except Exception as e:
                error_message = f"An error occurred while creating your account: {str(e)}"

    return render(request, 'typer/signup.html', {'error_message': error_message})


def login_view(request):
    """
    Handles user login styled with the active CSS theme variables.
    """
    if request.user.is_authenticated:
        return redirect('home')

    error_message = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        next_url = request.POST.get('next') or request.GET.get('next') or 'home'

        if not username or not password:
            error_message = "Please provide both username and password."
        else:
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect(next_url)
            else:
                error_message = "Invalid username or password. Please try again."

    return render(request, 'typer/login.html', {'error_message': error_message})


def logout_view(request):
    """Logs the user out and redirects to the home page."""
    logout(request)
    return redirect('home')


# ============================================================================
# 3. REST API ENDPOINTS
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
    If the user is authenticated, links records to request.user.
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
    user = request.user if request.user.is_authenticated else None

    with transaction.atomic():
        # Create TypingSession record linked to user (or None for guest)
        session = TypingSession.objects.create(
            user=user,
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
                    ks, _ = KeyStat.objects.get_or_create(user=user, character=char_key)
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
    Isolates personal data for authenticated users, preserving guest mode for unauthenticated users.
    """
    user = request.user if request.user.is_authenticated else None

    if user:
        sessions_qs = TypingSession.objects.filter(user=user)
        keystats_qs = KeyStat.objects.filter(user=user)
    else:
        sessions_qs = TypingSession.objects.filter(user__isnull=True)
        keystats_qs = KeyStat.objects.filter(user__isnull=True)

    recent_sessions_qs = sessions_qs.order_by('-created_at')[:15]
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
    qualified_keys = keystats_qs.filter(total_attempts__gte=5)
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
    for k in keystats_qs.all():
        all_keys[k.character] = {
            'attempts': k.total_attempts,
            'errors': k.error_count,
            'errorRate': k.error_rate,
        }

    # All-time Personal Best (PB) WPM for user/guest
    best_session = sessions_qs.order_by('-wpm').first()
    personal_best_wpm = round(best_session.wpm, 1) if best_session else 0

    # Consecutive Daily Practice Streak
    all_dates = set(sessions_qs.dates('created_at', 'day'))
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

    profile_data = None
    if user:
        profile = getattr(user, 'profile', None)
        profile_data = {
            'username': user.username,
            'skill_level': profile.skill_level if profile else 'Beginner',
            'favorite_languages': profile.get_languages_list() if profile else ['python'],
        }

    return JsonResponse({
        'sessions': sessions_list,
        'top_weak_keys': top_weak,
        'all_key_stats': all_keys,
        'total_sessions': sessions_qs.count(),
        'personal_best_wpm': personal_best_wpm,
        'daily_streak': daily_streak,
        'user_profile': profile_data,
    })


def api_topics_catalog(request):
    """
    GET /api/topics/catalog/
    Returns a randomized selection of curated Wikipedia topics from the backend
    catalog + live official Wikipedia REST API fetch & CachedTopic SQLite caching.
    """
    seed_all_if_needed()
    topics_qs = list(CuratedTopic.objects.filter(is_active=True))
    if not topics_qs:
        topics_qs = list(CuratedTopic.objects.all())

    import random
    sample_size = min(len(topics_qs), 12)
    selected_topics = random.sample(topics_qs, sample_size) if topics_qs else []

    results = []
    for t in selected_topics:
        cached = CachedTopic.objects.filter(title__iexact=t.title).first()
        if not cached:
            try:
                wiki_data = fetch_wikipedia_summary(t.title)
                if wiki_data and wiki_data.get('extract'):
                    cached = CachedTopic.objects.create(
                        title=wiki_data.get('title', t.title),
                        description=wiki_data.get('description', t.description),
                        summary_text=wiki_data['extract'],
                        source_url=wiki_data.get('source_url', f"https://en.wikipedia.org/wiki/{urllib.parse.quote(t.title.replace(' ', '_'))}")
                    )
            except Exception:
                pass

        extract = cached.summary_text if cached else ""
        desc = (cached.description if cached and cached.description else t.description)
        source_url = (cached.source_url if cached and cached.source_url else f"https://en.wikipedia.org/wiki/{urllib.parse.quote(t.title.replace(' ', '_'))}")

        results.append({
            'title': t.title,
            'display_title': t.display_title,
            'category': t.category,
            'description': desc or (extract[:140] + '...' if extract else ''),
            'icon': t.icon,
            'extract': extract,
            'source_url': source_url,
        })

    return JsonResponse({'success': True, 'topics': results, 'count': len(results)})


def api_code_snippets(request):
    """
    GET /api/code/snippets/?lang=<lang>&difficulty=<diff>
    Serves verified, runnable code snippets from backend CodeSnippet / PracticeDrill
    database table (auto-seeded if empty) across Python, C++, JS, SQL, Linux/Bash, and HTML/CSS.
    """
    seed_all_if_needed()
    lang = request.GET.get('lang', '').strip().lower()
    difficulty = request.GET.get('difficulty', '').strip()

    qs = CodeSnippet.objects.all()
    if lang:
        qs = qs.filter(language=lang)
    if difficulty and difficulty.lower() != 'all':
        qs = qs.filter(difficulty__iexact=difficulty)

    snippets = []
    for s in qs.order_by('order', 'id'):
        snippets.append({
            'id': s.snippet_id,
            'title': s.title,
            'filename': s.filename,
            'lang': s.language,
            'difficulty': s.difficulty,
            'icon': s.icon,
            'description': s.description,
            'code': s.code,
        })

    if not snippets and lang in CODE_SNIPPETS:
        snippets = CODE_SNIPPETS[lang]

    drills = []
    for d in PracticeDrill.objects.all().order_by('order'):
        drills.append({
            'id': d.drill_id,
            'title': d.title,
            'category': d.category,
            'tag': d.tag,
            'icon': d.icon,
            'difficulty': d.difficulty,
            'description': d.description,
            'text': d.text,
        })

    return JsonResponse({
        'success': True,
        'snippets': snippets,
        'count': len(snippets),
        'drills': drills,
    })


def api_recommendations(request):
    """
    GET /api/recommendations/
    Returns real-time personalized recommendations for the authenticated user or guest.
    """
    user = request.user if request.user.is_authenticated else None
    data = get_personalized_recommendations(user)
    return JsonResponse(data)
