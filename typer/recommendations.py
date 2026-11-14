"""
Personalized Recommendation Engine for TopicTyper v5.0.
Computes tailored topic cards, coding programs, and specialized drills based on:
1. User's selected favorite programming languages
2. User's current WPM speed tier (Pace Builder, Velocity Sprint, Hyperspeed Pro)
3. User's recorded weak keys and symbols from KeyStat.
"""

from .models import TypingSession, KeyStat, UserProfile
from .code_library import CODE_SNIPPETS, SPECIALIZED_DRILLS


def get_personalized_recommendations(user=None):
    """
    Returns a dict containing:
    - speed_tier: dict with name, badge, and description
    - recommended_programs: list of coding snippets matching favorite languages & tier
    - recommended_drills: list of drill cards (e.g. Symbols Gauntlet, Linux CLI, Numbers)
    - recommended_topics: curated Wikipedia topics appropriate for their speed
    - weak_keys_insight: string summary explaining why these were recommended
    """
    fav_langs = ['python', 'javascript']
    skill_level = 'Beginner'
    speed_tier_label = 'Pace Builder'
    speed_tier_badge = 'leaf'
    speed_tier_desc = 'Focus on rhythm, accuracy, and foundational muscle memory.'
    avg_wpm = 0.0
    weak_chars = []

    if user and user.is_authenticated:
        # Load user profile preferences
        profile = getattr(user, 'profile', None)
        if profile:
            fav_langs = profile.get_languages_list() or ['python', 'javascript']
            skill_level = profile.skill_level or 'Beginner'

        # Analyze speed from last 10 sessions
        recent_sessions = list(TypingSession.objects.filter(user=user).order_by('-created_at')[:10])
        if recent_sessions:
            avg_wpm = sum(s.wpm for s in recent_sessions) / len(recent_sessions)

        if avg_wpm >= 75 or skill_level == 'Pro':
            speed_tier_label = 'Hyperspeed Master'
            speed_tier_badge = 'bolt'
            speed_tier_desc = 'High-velocity flow state. Challenge yourself with complex syntax and DSA.'
        elif avg_wpm >= 40 or skill_level == 'Intermediate':
            speed_tier_label = 'Velocity Sprint'
            speed_tier_badge = 'rocket'
            speed_tier_desc = 'Solid typing base. Push speed on multi-line blocks and language idioms.'
        else:
            speed_tier_label = 'Pace Builder'
            speed_tier_badge = 'leaf'
            speed_tier_desc = 'Build accuracy and clean finger placement without looking at keys.'

        # Analyze weak keys
        top_weak = KeyStat.objects.filter(user=user, total_attempts__gte=3).order_by('-error_count')[:5]
        weak_chars = [k.character for k in top_weak]

    # Map skill level to code difficulty
    diff_preference = 'Beginner'
    if speed_tier_label == 'Hyperspeed Master':
        diff_preference = 'DSA & Algorithms'
    elif speed_tier_label == 'Velocity Sprint':
        diff_preference = 'Intermediate'

    # Select recommended code programs
    recommended_programs = []
    # Gather from favorite languages first
    for lang in fav_langs:
        snippets = CODE_SNIPPETS.get(lang, [])
        # Prefer matching difficulty
        matching = [s for s in snippets if s.get('difficulty') == diff_preference]
        if not matching:
            matching = snippets
        if matching:
            recommended_programs.append(matching[0])
            if len(matching) > 1 and len(recommended_programs) < 4:
                recommended_programs.append(matching[1])

    # Fill up to 3-4 programs if needed
    if len(recommended_programs) < 3:
        for lang, snippets in CODE_SNIPPETS.items():
            if lang not in fav_langs:
                for s in snippets:
                    if s.get('difficulty') == diff_preference and s not in recommended_programs:
                        recommended_programs.append(s)
                        break
            if len(recommended_programs) >= 4:
                break

    # Select recommended drill based on weak keys
    symbol_set = set('{}[]()<>=>!=&&||;:+-*/%^$#@!~')
    digit_set = set('0123456789')
    has_symbol_weakness = any(c in symbol_set for c in weak_chars)
    has_digit_weakness = any(c in digit_set for c in weak_chars)

    recommended_drills = []
    if has_symbol_weakness or diff_preference == 'DSA & Algorithms':
        recommended_drills.append(SPECIALIZED_DRILLS[0]) # Symbols Gauntlet
    if has_digit_weakness or diff_preference == 'Beginner':
        recommended_drills.append(SPECIALIZED_DRILLS[2]) # Numbers & Data Sprint
    if 'bash' in fav_langs or len(recommended_drills) < 2:
        recommended_drills.append(SPECIALIZED_DRILLS[1]) # Linux & Git CLI

    # Keep unique drills
    seen_ids = set()
    final_drills = []
    for d in recommended_drills:
        if d['id'] not in seen_ids:
            seen_ids.add(d['id'])
            final_drills.append(d)

    # Curate recommended topics
    topics_pool = [
        {'title': 'Quantum Computing', 'tag': 'Physics', 'icon': 'atom', 'min_tier': 'Velocity Sprint'},
        {'title': 'Artificial Intelligence', 'tag': 'Computing', 'icon': 'cpu', 'min_tier': 'Pace Builder'},
        {'title': 'Large Hadron Collider', 'tag': 'Engineering', 'icon': 'atom', 'min_tier': 'Hyperspeed Master'},
        {'title': 'James Webb Space Telescope', 'tag': 'Astronomy', 'icon': 'telescope', 'min_tier': 'Pace Builder'},
    ]

    weak_summary = ""
    if weak_chars:
        weak_summary = f"Weak keys detected: {', '.join(weak_chars[:3])}. We prioritized targeted syntax drills."
    else:
        weak_summary = f"Optimized for your {skill_level} level and {speed_tier_label} pace ({avg_wpm:.0f} WPM)."

    return {
        'speed_tier': {
            'label': speed_tier_label,
            'badge': speed_tier_badge,
            'description': speed_tier_desc,
            'avg_wpm': round(avg_wpm, 1),
        },
        'skill_level': skill_level,
        'favorite_languages': fav_langs,
        'recommended_programs': recommended_programs[:4],
        'recommended_drills': final_drills[:3],
        'recommended_topics': topics_pool[:3],
        'weak_keys_insight': weak_summary,
    }
