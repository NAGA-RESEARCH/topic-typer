from django.contrib import admin
from .models import TypingSession, KeyStat, CachedTopic


@admin.register(TypingSession)
class TypingSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'topic_title', 'mode', 'wpm', 'raw_wpm', 'accuracy', 'errors_count', 'characters_typed', 'duration_seconds', 'created_at')
    list_filter = ('mode', 'created_at')
    search_fields = ('topic_title',)
    ordering = ('-created_at',)


@admin.register(KeyStat)
class KeyStatAdmin(admin.ModelAdmin):
    list_display = ('character', 'total_attempts', 'error_count', 'get_error_rate')
    search_fields = ('character',)
    ordering = ('character',)

    @admin.display(description='Error Rate %')
    def get_error_rate(self, obj):
        return f"{obj.error_rate:.1f}%"


@admin.register(CachedTopic)
class CachedTopicAdmin(admin.ModelAdmin):
    list_display = ('title', 'description', 'source_url', 'fetched_at')
    search_fields = ('title', 'description', 'summary_text')
    ordering = ('-fetched_at',)
