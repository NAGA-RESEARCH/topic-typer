import json
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from .models import TypingSession, KeyStat, CachedTopic, UserProfile, CommunityPost, CommunityComment, CuratedTopic, CodeSnippet, PracticeDrill
from .code_library import CODE_SNIPPETS, SPECIALIZED_DRILLS, get_all_snippets


class TopicTyperViewTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_home_page_renders(self):
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'TopicTyper')
        self.assertContains(response, 'Master Typing. Learn the Universe.')
        self.assertContains(response, 'Naga Research Lab')
        # Top navbar Code Arena link
        self.assertContains(response, 'Code Arena')
        # Conditional Navbar Search: Hidden on Home
        self.assertNotContains(response, 'id="header-search-form"')
        self.assertContains(response, 'id="custom-topic-input"')
        # Personal Best & Streak Pills
        self.assertContains(response, 'id="home-pb-pill"')
        self.assertContains(response, 'id="home-streak-pill"')
        # Content Tabs (Wiki, Specialized Drills, Custom/Code)
        self.assertContains(response, 'id="tab-source-wiki"')
        self.assertContains(response, 'id="tab-source-drills"')
        self.assertContains(response, 'id="tab-source-custom"')
        # Zero default pre-selection on home load
        self.assertNotContains(response, 'topic-card selected')
        self.assertContains(response, 'id="topic-prompt-pill"')
        self.assertTemplateUsed(response, 'typer/index.html')
        self.assertTemplateUsed(response, 'typer/base.html')

    def test_practice_page_renders(self):
        response = self.client.get(reverse('practice'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'TopicTyper')
        self.assertContains(response, 'practice-arena')
        self.assertContains(response, 'caret')
        # Navbar Search active on practice page
        self.assertContains(response, 'id="header-search-form"')
        self.assertTemplateUsed(response, 'typer/practice.html')
        self.assertTemplateUsed(response, 'typer/base.html')

    def test_about_page_renders(self):
        response = self.client.get(reverse('about'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Naga Research Lab')
        self.assertContains(response, 'AK Bisariya')
        # Conditional Navbar Search: Hidden on About
        self.assertNotContains(response, 'id="header-search-form"')
        self.assertTemplateUsed(response, 'typer/about.html')
        self.assertTemplateUsed(response, 'typer/base.html')

    def test_api_topic_query(self):
        response = self.client.get(reverse('api_topic'), {'q': 'Solar System'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('title', data)
        self.assertIn('extract', data)
        self.assertGreater(len(data['extract']), 0)

        # Check model exists
        cached = CachedTopic.objects.filter(title__iexact='Solar System').first()
        self.assertIsNotNone(cached)

        # Second query hits cache
        response2 = self.client.get(reverse('api_topic'), {'q': 'Solar System'})
        self.assertEqual(response2.status_code, 200)
        data2 = response2.json()
        self.assertTrue(data2.get('cached', False))

    def test_api_random_topic(self):
        response = self.client.get(reverse('api_random_topic'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('title', data)
        self.assertIn('extract', data)
        self.assertGreater(len(data['extract']), 0)

    def test_api_session_save_and_analytics(self):
        payload = {
            'topic_title': 'Quantum Computing',
            'mode': 'paragraph',
            'duration_seconds': 48,
            'wpm': 65.5,
            'raw_wpm': 70.0,
            'accuracy': 95.2,
            'errors_count': 4,
            'characters_typed': 310,
            'key_stats': {
                'q': {'attempts': 10, 'errors': 3},
                'z': {'attempts': 8, 'errors': 2},
                'a': {'attempts': 25, 'errors': 1},
            }
        }

        response = self.client.post(
            reverse('api_save_session'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        res_data = response.json()
        self.assertEqual(res_data['status'], 'ok')
        self.assertEqual(TypingSession.objects.count(), 1)

        session = TypingSession.objects.first()
        self.assertEqual(session.topic_title, 'Quantum Computing')
        self.assertEqual(session.wpm, 65.5)

        # Check atomic KeyStat records
        q_stat = KeyStat.objects.get(character='q')
        self.assertEqual(q_stat.total_attempts, 10)
        self.assertEqual(q_stat.error_count, 3)
        self.assertEqual(q_stat.error_rate, 30.0)

        # Second session to verify atomic increment
        payload2 = {
            'topic_title': 'Astrophysics',
            'mode': 'timed',
            'duration_seconds': 60,
            'wpm': 72.0,
            'raw_wpm': 75.0,
            'accuracy': 98.0,
            'errors_count': 2,
            'characters_typed': 360,
            'key_stats': {
                'q': {'attempts': 5, 'errors': 1},
            }
        }
        self.client.post(
            reverse('api_save_session'),
            data=json.dumps(payload2),
            content_type='application/json'
        )
        q_stat.refresh_from_db()
        self.assertEqual(q_stat.total_attempts, 15)
        self.assertEqual(q_stat.error_count, 4)

        # Check analytics endpoint
        analytics_res = self.client.get(reverse('api_analytics'))
        self.assertEqual(analytics_res.status_code, 200)
        analytics_data = analytics_res.json()
        self.assertEqual(len(analytics_data['sessions']), 2)
        self.assertEqual(analytics_data['sessions'][0]['topic'], 'Quantum Computing')
        self.assertEqual(analytics_data['sessions'][1]['topic'], 'Astrophysics')

        top_weak = analytics_data['top_weak_keys']
        self.assertGreaterEqual(len(top_weak), 1)
        self.assertEqual(top_weak[0]['character'], 'q')

        self.assertEqual(analytics_data['personal_best_wpm'], 72.0)
        self.assertGreaterEqual(analytics_data['daily_streak'], 1)

    def test_sound_engine_ui_and_assets(self):
        """Verify Sound Studio dropdown, profile options, and script inclusion."""
        for view_name in ['home', 'practice', 'about', 'community']:
            response = self.client.get(reverse(view_name))
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'sound.js')
            self.assertContains(response, 'id="sound-toggle-btn"')
            self.assertContains(response, 'id="sound-dropdown-menu"')
            self.assertContains(response, 'id="sound-master-toggle"')
            self.assertContains(response, 'data-profile="creamy"')
            self.assertContains(response, 'data-profile="brown"')
            self.assertContains(response, 'data-profile="blue"')
            self.assertContains(response, 'data-profile="typewriter"')
            self.assertContains(response, 'data-profile="sync"')

    # =========================================================================
    # v6.0 FEATURE TESTS: CODE ARENA (LOGIN-GATED)
    # =========================================================================

    def test_code_arena_page_renders(self):
        """Verify dedicated Code Arena (/code/) features, login-gating for guests, and IDE UI for authenticated users."""
        # Unauthenticated guest is redirected to login
        guest_response = self.client.get(reverse('code_arena'))
        self.assertEqual(guest_response.status_code, 302)
        self.assertIn('/login/', guest_response['Location'])

        # Authenticated user gets full IDE
        user = User.objects.create_user(username='ide_coder', password='password123')
        self.client.login(username='ide_coder', password='password123')

        response = self.client.get(reverse('code_arena'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'IDE Code Arena')
        self.assertContains(response, 'id="code-arena-shell"')
        self.assertContains(response, 'id="ide-workspace"')
        self.assertContains(response, 'id="ide-gutter"')
        self.assertContains(response, 'id="code-words-container"')
        self.assertContains(response, 'id="code-caret"')

        # Check all 6 languages are present in selector tabs
        for lang_name in ['Python', 'C++', 'JavaScript', 'SQL', 'Linux / Bash', 'HTML / CSS']:
            self.assertContains(response, lang_name)

        # Check difficulty filter options
        for diff in ['All', 'Beginner', 'Intermediate', 'DSA & Algorithms']:
            self.assertContains(response, diff)

        # Check smart indent badge & titlebar
        self.assertContains(response, 'Smart Enter Indent')
        self.assertContains(response, 'ide-window-controls')
        self.assertTemplateUsed(response, 'typer/code_arena.html')
        self.assertTemplateUsed(response, 'typer/base.html')

    def test_code_snippets_library_count_and_diversity(self):
        """Verify rich curated library with 35+ programs across 6 languages."""
        all_snippets = get_all_snippets()
        self.assertGreaterEqual(len(all_snippets), 35)

        languages = ['python', 'cpp', 'javascript', 'sql', 'bash', 'html_css']
        for lang in languages:
            self.assertIn(lang, CODE_SNIPPETS)
            snippets = CODE_SNIPPETS[lang]
            self.assertGreaterEqual(len(snippets), 6)
            # Ensure multiple difficulty levels
            diffs = {s['difficulty'] for s in snippets}
            self.assertIn('Beginner', diffs)
            self.assertIn('DSA & Algorithms', diffs)

    def test_api_code_snippets_endpoint(self):
        """Verify REST API for code snippet querying and filtering."""
        # Query all
        res_all = self.client.get(reverse('api_code_snippets'))
        self.assertEqual(res_all.status_code, 200)
        data_all = res_all.json()
        self.assertGreaterEqual(data_all['count'], 35)

        # Filter by language
        res_py = self.client.get(reverse('api_code_snippets'), {'lang': 'python'})
        self.assertEqual(res_py.status_code, 200)
        data_py = res_py.json()
        self.assertEqual(data_py['count'], len(CODE_SNIPPETS['python']))

        # Filter by language and difficulty
        res_dsa = self.client.get(reverse('api_code_snippets'), {'lang': 'python', 'difficulty': 'DSA & Algorithms'})
        self.assertEqual(res_dsa.status_code, 200)
        data_dsa = res_dsa.json()
        for s in data_dsa['snippets']:
            self.assertEqual(s['difficulty'], 'DSA & Algorithms')

    # =========================================================================
    # v5.0 FEATURE TESTS: USER AUTHENTICATION & PERSONALIZED RECOMMENDATIONS
    # =========================================================================

    def test_signup_login_and_logout_flow(self):
        """Verify user signup with custom preferences (languages & skill level), login and logout."""
        # 1. Signup
        signup_data = {
            'username': 'coder_pro',
            'email': 'coder@example.com',
            'password': 'secretpassword123',
            'confirm_password': 'secretpassword123',
            'skill_level': 'Pro',
            'languages': ['python', 'cpp', 'sql'],
        }
        response = self.client.post(reverse('signup'), data=signup_data)
        self.assertEqual(response.status_code, 302) # Redirects to home

        # Verify user and profile in DB
        user = User.objects.get(username='coder_pro')
        self.assertIsNotNone(user)
        self.assertEqual(user.profile.skill_level, 'Pro')
        self.assertEqual(user.profile.get_languages_list(), ['python', 'cpp', 'sql'])

        # Verify home shows authenticated state
        home_res = self.client.get(reverse('home'))
        self.assertContains(home_res, 'coder_pro')
        self.assertContains(home_res, 'Pro')
        self.assertContains(home_res, 'Recommended For You')

        # 2. Logout
        logout_res = self.client.get(reverse('logout'))
        self.assertEqual(logout_res.status_code, 302)

        # 3. Bad login rejected
        bad_login = self.client.post(reverse('login'), data={'username': 'coder_pro', 'password': 'wrongpassword'})
        self.assertEqual(bad_login.status_code, 200)
        self.assertContains(bad_login, 'Invalid username or password')

        # 4. Valid Login
        login_res = self.client.post(reverse('login'), data={'username': 'coder_pro', 'password': 'secretpassword123'})
        self.assertEqual(login_res.status_code, 302)

    def test_user_linked_isolated_analytics(self):
        """Verify user sessions & KeyStats are isolated between authenticated user and guest."""
        user = User.objects.create_user(username='sarah_dev', password='pass123password')
        UserProfile.objects.create(user=user, skill_level='Intermediate', favorite_languages='python,javascript')

        self.client.login(username='sarah_dev', password='pass123password')

        # Save authenticated user session
        payload = {
            'topic_title': 'Python: Timing Decorator',
            'mode': 'code',
            'duration_seconds': 25,
            'wpm': 82.0,
            'raw_wpm': 85.0,
            'accuracy': 99.0,
            'errors_count': 1,
            'characters_typed': 175,
            'key_stats': {
                'x': {'attempts': 12, 'errors': 4},
            }
        }
        res = self.client.post(reverse('api_save_session'), data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 200)

        # Verify linked to user
        session = TypingSession.objects.get(topic_title='Python: Timing Decorator')
        self.assertEqual(session.user, user)
        k_stat = KeyStat.objects.get(user=user, character='x')
        self.assertEqual(k_stat.error_count, 4)

        # Verify analytics endpoint isolates user data
        analytics_res = self.client.get(reverse('api_analytics'))
        self.assertEqual(analytics_res.status_code, 200)
        data = analytics_res.json()
        self.assertEqual(data['user_profile']['username'], 'sarah_dev')
        self.assertEqual(data['user_profile']['skill_level'], 'Intermediate')
        self.assertEqual(data['personal_best_wpm'], 82.0)

        # Guest mode isolation
        guest_client = Client()
        guest_analytics = guest_client.get(reverse('api_analytics')).json()
        # Guest does not see sarah's sessions
        for s in guest_analytics['sessions']:
            self.assertNotEqual(s['topic'], 'Python: Timing Decorator')

    def test_personalized_recommendation_engine(self):
        """Verify recommendation engine tailors content to user tier, weak keys, and languages."""
        user = User.objects.create_user(username='dsa_coder', password='pass123password')
        UserProfile.objects.create(user=user, skill_level='Pro', favorite_languages='python,cpp')

        # Add weak key stats on symbols
        KeyStat.objects.create(user=user, character='{', total_attempts=20, error_count=10)
        KeyStat.objects.create(user=user, character=';', total_attempts=15, error_count=6)

        self.client.login(username='dsa_coder', password='pass123password')

        rec_res = self.client.get(reverse('api_recommendations'))
        self.assertEqual(rec_res.status_code, 200)
        rec_data = rec_res.json()

        self.assertEqual(rec_data['skill_level'], 'Pro')
        self.assertEqual(rec_data['speed_tier']['label'], 'Hyperspeed Master')
        # Weak keys trigger Symbols & Brackets Gauntlet drill
        drill_titles = [d['title'] for d in rec_data['recommended_drills']]
        self.assertIn('Symbols & Brackets Gauntlet', drill_titles)

    # =========================================================================
    # v5.0 FEATURE TESTS: SPECIALIZED DRILLS (REQUIREMENT 4)
    # =========================================================================

    def test_specialized_drills_cards_rendered(self):
        """Verify 3 dedicated drill cards exist with proper descriptions and triggers."""
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)

        # Symbols & Brackets Gauntlet
        self.assertContains(response, 'Symbols &amp; Brackets Gauntlet')
        self.assertContains(response, '{} [] ()')

        # Linux & Git Command Line
        self.assertContains(response, 'Linux &amp; Git Command Line')
        self.assertContains(response, 'git checkout')

        # Numbers & Data Sprint
        self.assertContains(response, 'Numbers &amp; Data Sprint')
        self.assertContains(response, 'Invoice #98214')

    # =========================================================================
    # OVERHAUL FEATURE TESTS: PROFILE DASHBOARD, THEMES, FOOTER & TELEMETRY
    # =========================================================================

    def test_profile_page_unauthenticated_redirect(self):
        """Unauthenticated access to /profile/ redirects to login."""
        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.url)

    def test_profile_page_authenticated_renders(self):
        """Authenticated access renders full dashboard with lifetime telemetry and achievements."""
        user = User.objects.create_user(username='aman', password='password123')
        UserProfile.objects.create(user=user, skill_level='Intermediate', favorite_languages='python,javascript')

        # Create sample sessions
        TypingSession.objects.create(
            user=user,
            topic_title='Python: QuickSort Algorithm',
            mode='code',
            duration_seconds=45,
            wpm=72.5,
            raw_wpm=75.0,
            accuracy=98.5,
            characters_typed=250,
            errors_count=2
        )
        TypingSession.objects.create(
            user=user,
            topic_title='Quantum Mechanics',
            mode='paragraph',
            duration_seconds=60,
            wpm=65.0,
            raw_wpm=68.0,
            accuracy=99.0,
            characters_typed=320,
            errors_count=1
        )

        self.client.login(username='aman', password='password123')
        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'aman')
        self.assertContains(response, 'Lifetime Telemetry')
        self.assertContains(response, '72.5')  # Best WPM
        self.assertContains(response, '98.8')  # Avg accuracy ~98.8%
        self.assertContains(response, 'Unlockable Achievement Badges')
        self.assertContains(response, 'Language &amp; Mode Breakdown')
        self.assertTemplateUsed(response, 'typer/profile.html')

    def test_profile_page_post_updates_preferences(self):
        """User can update skill level and favorite languages via POST."""
        user = User.objects.create_user(username='aman_dev', password='password123')
        UserProfile.objects.create(user=user, skill_level='Beginner', favorite_languages='python')
        self.client.login(username='aman_dev', password='password123')

        post_data = {
            'skill_level': 'Pro',
            'languages': ['python', 'cpp', 'sql']
        }
        response = self.client.post(reverse('profile'), data=post_data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'updated successfully')

        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.skill_level, 'Pro')
        self.assertEqual(profile.get_languages_list(), ['python', 'cpp', 'sql'])

    def test_navbar_profile_link_for_authenticated_user(self):
        """Navbar displays clean single user pill with SVG icon linking to /profile/ and compact Sign Out."""
        user = User.objects.create_user(username='aman_nav', password='password123')
        UserProfile.objects.create(user=user, skill_level='Pro')
        self.client.login(username='aman_nav', password='password123')

        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'href="/profile/"')
        self.assertContains(response, 'user-pill-btn')
        self.assertContains(response, 'aman_nav')
        self.assertContains(response, 'Sign Out')

    def test_zen_matcha_and_warm_amber_themes_in_navbar(self):
        """Navbar theme dropdown includes Zen Matcha and Warm Amber options."""
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-theme="zen_matcha"')
        self.assertContains(response, 'Zen Matcha')
        self.assertContains(response, 'data-theme="warm_amber"')
        self.assertContains(response, 'Warm Amber')

    def test_clean_balanced_footer(self):
        """Footer displays Naga Research Lab & AK Bisariya credits, Twitter social button, Tab/Esc shortcuts, and NO duplicate nav buttons."""
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Naga Research Lab by AK Bisariya')
        self.assertContains(response, 'footer-lab-highlight')
        self.assertContains(response, 'Twitter')
        self.assertContains(response, 'Next')
        self.assertContains(response, 'Restart')
        # Duplicate buttons removed from footer
        self.assertNotContains(response, 'class="footer-about-pill"')

    # =========================================================================
    # v6.0 FEATURE TESTS: COMMUNITY HUB & BACKEND APIS & ZERO EMOJIS
    # =========================================================================

    def test_community_hub_renders_for_guest_and_user(self):
        """Verify Community Hub (/community/) is readable by guests and allows posts/comments for authenticated users."""
        # Guest read
        res = self.client.get(reverse('community'))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'Community &amp; Feedback Hub')
        self.assertContains(res, 'community-posts-list')
        self.assertContains(res, 'Feature Idea')
        self.assertContains(res, 'Topic Request')
        self.assertContains(res, 'Bug Report')

        # Authenticated user post creation
        user = User.objects.create_user(username='community_user', password='password123')
        self.client.login(username='community_user', password='password123')

        post_res = self.client.post(reverse('community_post_create'), {
            'title': 'Add Quantum Physics Drills',
            'category': 'Topic Request',
            'body': 'Would love to see more quantum mechanics and wave equation paragraphs.'
        })
        self.assertEqual(post_res.status_code, 302)

        # Verify post exists
        post = CommunityPost.objects.get(title='Add Quantum Physics Drills')
        self.assertEqual(post.category, 'Topic Request')
        self.assertEqual(post.user, user)

        # Upvote post
        upvote_res = self.client.post(reverse('community_post_upvote', kwargs={'post_id': post.id}))
        self.assertEqual(upvote_res.status_code, 200)
        upvote_data = upvote_res.json()
        self.assertTrue(upvote_data['upvoted'])
        self.assertEqual(upvote_data['upvote_count'], 1)

        # Add comment
        comment_res = self.client.post(reverse('community_comment_create', kwargs={'post_id': post.id}), {
            'body': 'Great suggestion, fully agreed!'
        }, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(comment_res.status_code, 200)
        comment_data = comment_res.json()
        self.assertTrue(comment_data['success'])
        self.assertEqual(comment_data['author'], 'community_user')

    def test_api_topics_catalog(self):
        """Verify GET /api/topics/catalog/ returns seeded Wikipedia topics with vector icon keys and zero emojis."""
        res = self.client.get(reverse('api_topics_catalog'))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertGreaterEqual(len(data['topics']), 7)
        first_topic = data['topics'][0]
        self.assertIn('title', first_topic)
        self.assertIn('category', first_topic)
        self.assertIn('icon', first_topic)

    def test_api_code_snippets(self):
        """Verify GET /api/code/snippets/?lang=python returns verified code snippets with zero emojis."""
        res = self.client.get(reverse('api_code_snippets'), {'lang': 'python'})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertGreaterEqual(len(data['snippets']), 1)
        first_snippet = data['snippets'][0]
        self.assertEqual(first_snippet['lang'], 'python')
        self.assertIn('code', first_snippet)
        self.assertIn('filename', first_snippet)

    def test_guest_access_control_and_hero_hierarchy(self):
        """Verify Wikipedia Topic Typing is in core hero position on home, and secondary features prompt login."""
        # 1. Home page renders hero-first Wikipedia topic section directly under header
        home_res = self.client.get(reverse('home'))
        self.assertEqual(home_res.status_code, 200)
        self.assertContains(home_res, 'id="panel-source-wiki"')
        self.assertContains(home_res, 'id="curated-topic-grid"')
        self.assertContains(home_res, 'id="guest-lock-modal"')

        # 2. Guest can access Wikipedia paragraph and timed practice smoothly
        practice_res = self.client.get(reverse('practice'))
        self.assertEqual(practice_res.status_code, 200)
        self.assertContains(practice_res, 'id="typing-section"')
        self.assertContains(practice_res, 'id="zen-mode-toggle"')
        self.assertContains(practice_res, 'id="stat-pb-delta"')

        # 3. Guest trying to access protected mode (code or drill) gets redirected to login
        guest_code_res = self.client.get(reverse('practice'), {'mode': 'code'})
        self.assertEqual(guest_code_res.status_code, 302)
        self.assertIn('/login/', guest_code_res['Location'])

    def test_live_keycap_visualizer_and_waveform_rendered(self):
        """Verify tactile mechanical keycap visualizer strip and rhythm waveform pulse bar in practice and code arena."""
        # 1. Practice Arena
        practice_res = self.client.get(reverse('practice'))
        self.assertEqual(practice_res.status_code, 200)
        self.assertContains(practice_res, 'id="rhythm-waveform-bar"')
        self.assertContains(practice_res, 'id="rhythm-waveform-canvas"')
        self.assertContains(practice_res, 'id="waveform-combo-pill"')
        self.assertContains(practice_res, 'id="keycap-visualizer-section"')
        self.assertContains(practice_res, 'id="keycap-board"')
        self.assertContains(practice_res, 'id="keycap-toggle-btn"')
        self.assertContains(practice_res, 'id="keycap-next-char"')

        # 2. Code Arena (authenticated)
        user = User.objects.create_user(username='tactile_dev', password='password123')
        self.client.login(username='tactile_dev', password='password123')
        code_res = self.client.get(reverse('code_arena'))
        self.assertEqual(code_res.status_code, 200)
        self.assertContains(code_res, 'id="code-rhythm-waveform-bar"')
        self.assertContains(code_res, 'id="code-rhythm-waveform-canvas"')
        self.assertContains(code_res, 'id="code-waveform-combo-pill"')
        self.assertContains(code_res, 'id="code-keycap-visualizer-section"')
        self.assertContains(code_res, 'id="code-keycap-board"')
        self.assertContains(code_res, 'id="code-keycap-toggle-btn"')
        self.assertContains(code_res, 'id="code-keycap-next-char"')

    def test_elevated_topic_cards_and_glassmorphism(self):
        """Verify redesigned topic cards with category accent strips, geometric SVG patterns, and estimated time badges."""
        home_res = self.client.get(reverse('home'))
        self.assertEqual(home_res.status_code, 200)
        self.assertContains(home_res, 'topic-card-accent-strip')
        self.assertContains(home_res, 'topic-card-pattern')
        self.assertContains(home_res, 'topic-time-badge')
        self.assertContains(home_res, '~45s')

    def test_javascript_runtime_crash_fix_and_classes(self):
        """Verify app.js defines handleTypingActivity, KeycapVisualizer, and RhythmWaveformVisualizer."""
        import subprocess
        node_script = """
        const fs = require('fs');
        let js = fs.readFileSync('typer/static/typer/js/app.js', 'utf8');
        global.window = { location: { search: '' }, addEventListener: () => {}, devicePixelRatio: 1 };
        global.document = {
          addEventListener: () => {},
          getElementById: () => null,
          querySelectorAll: () => [],
          createElement: () => ({ className: '', classList: { add: () => {}, remove: () => {}, contains: () => false }, appendChild: () => {}, dataset: {} }),
          documentElement: { setAttribute: () => {} },
          body: { classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false } }
        };
        global.localStorage = { getItem: () => null, setItem: () => {} };
        global.sessionStorage = { getItem: () => null, setItem: () => {} };
        global.requestAnimationFrame = (cb) => 1;
        global.cancelAnimationFrame = () => {};
        global.performance = { now: () => Date.now() };

        eval(js + '; global.PracticePageController = PracticePageController; global.CodeArenaController = CodeArenaController; global.KeycapVisualizer = KeycapVisualizer; global.RhythmWaveformVisualizer = RhythmWaveformVisualizer;');

        if (typeof PracticePageController.prototype.handleTypingActivity !== 'function') {
          throw new Error('PracticePageController.prototype.handleTypingActivity is missing');
        }
        if (typeof CodeArenaController.prototype.handleTypingActivity !== 'function') {
          throw new Error('CodeArenaController.prototype.handleTypingActivity is missing');
        }
        if (typeof KeycapVisualizer !== 'function') {
          throw new Error('KeycapVisualizer is missing');
        }
        if (typeof RhythmWaveformVisualizer !== 'function') {
          throw new Error('RhythmWaveformVisualizer is missing');
        }
        console.log('SUCCESS');
        """
        proc = subprocess.run(['node', '-e', node_script], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, msg=f"Node verification failed: {proc.stderr}")
        self.assertIn('SUCCESS', proc.stdout)
