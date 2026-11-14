from django.contrib import admin
from .models import TypingSession, KeyStat, CachedTopic, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'skill_level', 'favorite_languages', 'created_at')
    list_filter = ('skill_level', 'created_at')
    search_fields = ('user__username', 'user__email')


@admin.register(TypingSession)
class TypingSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'topic_title', 'mode', 'wpm', 'raw_wpm', 'accuracy', 'errors_count', 'characters_typed', 'duration_seconds', 'created_at')
    list_filter = ('mode', 'created_at', 'user')
    search_fields = ('topic_title', 'user__username')
    ordering = ('-created_at',)


@admin.register(KeyStat)
class KeyStatAdmin(admin.ModelAdmin):
    list_display = ('character', 'user', 'total_attempts', 'error_count', 'get_error_rate')
    list_filter = ('user',)
    search_fields = ('character', 'user__username')
    ordering = ('character',)

    @admin.display(description='Error Rate %')
    def get_error_rate(self, obj):
        return f"{obj.error_rate:.1f}%"


@admin.register(CachedTopic)
class CachedTopicAdmin(admin.ModelAdmin):
    list_display = ('title', 'description', 'source_url', 'fetched_at')
    search_fields = ('title', 'description', 'summary_text')
    ordering = ('-fetched_at',)
