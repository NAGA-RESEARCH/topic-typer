from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    SKILL_CHOICES = [
        ('Beginner', 'Beginner'),
        ('Intermediate', 'Intermediate'),
        ('Pro', 'Pro'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    skill_level = models.CharField(max_length=20, default='Beginner', choices=SKILL_CHOICES)
    favorite_languages = models.CharField(max_length=255, default='python,javascript')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def get_languages_list(self):
        if not self.favorite_languages:
            return []
        return [l.strip().lower() for l in self.favorite_languages.split(',') if l.strip()]

    def __str__(self):
        return f"{self.user.username} ({self.skill_level})"


class TypingSession(models.Model):
    MODE_CHOICES = [
        ('paragraph', 'Paragraph'),
        ('timed', 'Timed'),
        ('drill', 'Drill'),
        ('custom', 'Custom'),
        ('code', 'Code'),
    ]

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='typing_sessions')
    topic_title = models.CharField(max_length=255)
    mode = models.CharField(max_length=20, default='paragraph', choices=MODE_CHOICES)
    duration_seconds = models.IntegerField(default=0)
    wpm = models.FloatField(default=0.0)
    raw_wpm = models.FloatField(default=0.0)
    accuracy = models.FloatField(default=100.0)
    errors_count = models.IntegerField(default=0)
    characters_typed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Typing Session'
        verbose_name_plural = 'Typing Sessions'

    def __str__(self):
        user_str = self.user.username if self.user else "Guest"
        return f"[{user_str}] {self.topic_title} ({self.mode}) — {self.wpm:.0f} WPM ({self.accuracy:.1f}%)"


class KeyStat(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='key_stats')
    character = models.CharField(max_length=5)
    total_attempts = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['character']
        verbose_name = 'Key Statistic'
        verbose_name_plural = 'Key Statistics'
        unique_together = [['user', 'character']]

    def __str__(self):
        user_str = self.user.username if self.user else "Guest"
        return f"[{user_str}] '{self.character}': {self.error_count}/{self.total_attempts} ({self.error_rate:.1f}%)"

    @property
    def error_rate(self):
        if self.total_attempts > 0:
            return round((self.error_count / self.total_attempts) * 100, 1)
        return 0.0


class CachedTopic(models.Model):
    title = models.CharField(max_length=255, unique=True, db_index=True)
    description = models.CharField(max_length=500, blank=True)
    summary_text = models.TextField()
    source_url = models.URLField(max_length=500, blank=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fetched_at']
        verbose_name = 'Cached Topic'
        verbose_name_plural = 'Cached Topics'

    def __str__(self):
        return self.title


class CuratedTopic(models.Model):
    title = models.CharField(max_length=255, unique=True, db_index=True)
    display_title = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    description = models.CharField(max_length=500, blank=True)
    icon = models.CharField(max_length=50, default='globe')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'title']
        verbose_name = 'Curated Topic'
        verbose_name_plural = 'Curated Topics'

    def __str__(self):
        return f"{self.display_title} ({self.category})"


class CodeSnippet(models.Model):
    LANGUAGE_CHOICES = [
        ('python', 'Python'),
        ('cpp', 'C++'),
        ('javascript', 'JavaScript'),
        ('sql', 'SQL'),
        ('bash', 'Linux / Bash'),
        ('html_css', 'HTML/CSS'),
    ]

    DIFFICULTY_CHOICES = [
        ('Beginner', 'Beginner'),
        ('Intermediate', 'Intermediate'),
        ('DSA & Algorithms', 'DSA & Algorithms'),
    ]

    snippet_id = models.CharField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    filename = models.CharField(max_length=255)
    language = models.CharField(max_length=50, choices=LANGUAGE_CHOICES, db_index=True)
    difficulty = models.CharField(max_length=50, choices=DIFFICULTY_CHOICES, default='Beginner', db_index=True)
    icon = models.CharField(max_length=50, default='code')
    description = models.TextField(blank=True)
    code = models.TextField()
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['language', 'order', 'title']
        verbose_name = 'Code Snippet'
        verbose_name_plural = 'Code Snippets'

    def __str__(self):
        return f"[{self.language}] {self.title} ({self.difficulty})"


class PracticeDrill(models.Model):
    drill_id = models.CharField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=50, default='Drill')
    tag = models.CharField(max_length=100)
    icon = models.CharField(max_length=50, default='terminal')
    difficulty = models.CharField(max_length=50, default='Intermediate')
    description = models.TextField()
    text = models.TextField()
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'title']
        verbose_name = 'Practice Drill'
        verbose_name_plural = 'Practice Drills'

    def __str__(self):
        return f"{self.title} ({self.tag})"


class CommunityPost(models.Model):
    CATEGORY_CHOICES = [
        ('Feature Idea', 'Feature Idea'),
        ('Bug Report', 'Bug Report'),
        ('Topic Request', 'Topic Request'),
        ('General', 'General'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='community_posts')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='General')
    title = models.CharField(max_length=255)
    body = models.TextField()
    upvotes = models.ManyToManyField(User, related_name='upvoted_posts', blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Community Post'
        verbose_name_plural = 'Community Posts'

    def __str__(self):
        return f"[{self.category}] {self.title} by {self.user.username}"

    @property
    def upvote_count(self):
        return self.upvotes.count()

    @property
    def comment_count(self):
        return self.comments.count()


class CommunityComment(models.Model):
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='community_comments')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Community Comment'
        verbose_name_plural = 'Community Comments'

    def __str__(self):
        return f"Comment by {self.user.username} on #{self.post.id}"

