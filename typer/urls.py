from django.urls import path
from . import views

urlpatterns = [
    # HTML Views
    path('', views.home_view, name='home'),
    path('practice/', views.practice_view, name='practice'),
    path('about/', views.about_view, name='about'),

    # REST API Endpoints
    path('api/topic/', views.api_topic, name='api_topic'),
    path('api/topic/random/', views.api_random_topic, name='api_random_topic'),
    path('api/session/save/', views.api_save_session, name='api_save_session'),
    path('api/analytics/', views.api_analytics, name='api_analytics'),
]
