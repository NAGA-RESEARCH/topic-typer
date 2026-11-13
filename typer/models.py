from django.db import models


class TypingSession(models.Model):
    MODE_CHOICES = [
        ('paragraph', 'Paragraph'),
        ('timed', 'Timed'),
        ('drill', 'Drill'),
    ]

    topic_title = models.CharField(max_length=255)
    mode = models.CharField(max_length=20, default='paragraph', choices=MODE_CHOICES)
    duration_seconds = models.IntegerField(default=0)
    wpm = models.FloatField(default=0.0)
    raw_wpm = models.FloatField(default=0.0)
    accuracy = models.FloatField(default=100.0)
    errors_count = models.IntegerField(default=0)
    characters_typed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Typing Session'
        verbose_name_plural = 'Typing Sessions'

    def __str__(self):
        return f"{self.topic_title} ({self.mode}) — {self.wpm:.0f} WPM ({self.accuracy:.1f}%)"


class KeyStat(models.Model):
    character = models.CharField(max_length=5, unique=True)
    total_attempts = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['character']
        verbose_name = 'Key Statistic'
        verbose_name_plural = 'Key Statistics'

    def __str__(self):
        return f"'{self.character}': {self.error_count}/{self.total_attempts} ({self.error_rate:.1f}%)"

    @property
    def error_rate(self):
        if self.total_attempts > 0:
            return round((self.error_count / self.total_attempts) * 100, 1)
        return 0.0


class CachedTopic(models.Model):
    title = models.CharField(max_length=255, unique=True)
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
