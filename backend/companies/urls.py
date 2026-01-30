"""
URL configuration for companies API.
"""
from django.urls import path
from . import views

urlpatterns = [
    path("companies", views.create_company, name="create_company"),
    path("companies/status", views.company_status, name="company_status"),
]
