import json
from django.test import TestCase, Client
from django.urls import reverse
from .models import TypingSession, KeyStat, CachedTopic


class TopicTyperViewTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_home_page_renders(self):
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'TopicTyper')
        self.assertContains(response, 'Master Typing. Learn the Universe.')
        self.assertContains(response, 'Naga Research Lab')
        # Conditional Navbar Search: Hidden on Home
        self.assertNotContains(response, 'id="header-search-form"')
        self.assertContains(response, 'id="custom-topic-input"')
        # Personal Best & Streak Pills
        self.assertContains(response, 'id="home-pb-pill"')
        self.assertContains(response, 'id="home-streak-pill"')
        # Custom / Code Tabs
        self.assertContains(response, 'id="tab-source-wiki"')
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
        # First query: should fetch or mock and cache in SQLite
        response = self.client.get(reverse('api_topic'), {'q': 'Solar System'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('title', data)
        self.assertIn('extract', data)
        self.assertGreater(len(data['extract']), 0)

        # Check model exists
        cached = CachedTopic.objects.filter(title__iexact='Solar System').first()
        self.assertIsNotNone(cached)

        # Second query: should hit cache
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
        # Oldest first order
        self.assertEqual(analytics_data['sessions'][0]['topic'], 'Quantum Computing')
        self.assertEqual(analytics_data['sessions'][1]['topic'], 'Astrophysics')

        # Check weak keys
        top_weak = analytics_data['top_weak_keys']
        self.assertGreaterEqual(len(top_weak), 1)
        self.assertEqual(top_weak[0]['character'], 'q')

        # Check Personal Best WPM and Daily Streak computation
        self.assertEqual(analytics_data['personal_best_wpm'], 72.0)
        self.assertGreaterEqual(analytics_data['daily_streak'], 1)

        # Test Code Mode and Custom Mode in session save
        code_payload = {
            'topic_title': 'Python: Fibonacci Generator',
            'mode': 'code',
            'duration_seconds': 35,
            'wpm': 85.0,
            'raw_wpm': 88.0,
            'accuracy': 98.5,
            'errors_count': 1,
            'characters_typed': 240,
        }
        res_code = self.client.post(
            reverse('api_save_session'),
            data=json.dumps(code_payload),
            content_type='application/json'
        )
        self.assertEqual(res_code.status_code, 200)
        session_code = TypingSession.objects.filter(mode='code').first()
        self.assertIsNotNone(session_code)
        self.assertEqual(session_code.mode, 'code')

        # Database index checks
        self.assertTrue(TypingSession._meta.get_field('created_at').db_index)
        self.assertTrue(CachedTopic._meta.get_field('title').db_index)

    def test_sound_engine_ui_and_assets(self):
        """Verify Sound Studio dropdown, profile options, and script inclusion."""
        for view_name in ['home', 'practice', 'about']:
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
