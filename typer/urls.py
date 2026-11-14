from django.urls import path
from . import views

urlpatterns = [
    # HTML Views
    path('', views.home_view, name='home'),
    path('code/', views.code_arena_view, name='code_arena'),
    path('practice/', views.practice_view, name='practice'),
    path('about/', views.about_view, name='about'),
    path('profile/', views.profile_view, name='profile'),
    path('community/', views.community_view, name='community'),
    path('community/post/create/', views.community_post_create, name='community_post_create'),
    path('community/post/<int:post_id>/upvote/', views.community_post_upvote, name='community_post_upvote'),
    path('community/post/<int:post_id>/comment/', views.community_comment_create, name='community_comment_create'),

    # Authentication Views
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # REST API Endpoints
    path('api/topic/', views.api_topic, name='api_topic'),
    path('api/topic/random/', views.api_random_topic, name='api_random_topic'),
    path('api/topics/catalog/', views.api_topics_catalog, name='api_topics_catalog'),
    path('api/session/save/', views.api_save_session, name='api_save_session'),
    path('api/analytics/', views.api_analytics, name='api_analytics'),
    path('api/code/snippets/', views.api_code_snippets, name='api_code_snippets'),
    path('api/recommendations/', views.api_recommendations, name='api_recommendations'),
]
