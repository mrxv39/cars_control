from django.contrib import admin
from .models import Membership

@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "company", "role", "created_at")
    list_filter = ("company", "role")
    search_fields = ("user__username", "user__email", "company__name")
