"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Admin (panel principal)
    path("admin/", admin.site.urls),

    # API inbound (Gmail / integraciones externas)
    path("api/", include("leads.inbound_urls")),
    
    # API for company management
    path("api/", include("companies.urls")),
]
