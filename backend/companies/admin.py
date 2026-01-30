from django.contrib import admin
from django.utils.html import format_html
from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        "id", 
        "name", 
        "slug", 
        "status_badge",
        "created_by", 
        "approved_by", 
        "approved_at",
        "created_at"
    )
    search_fields = ("name", "slug")
    list_filter = ("status", "is_active", "created_at", "approved_at")
    readonly_fields = ("created_at", "approved_at", "approved_by")
    
    fieldsets = (
        ("Company Information", {
            "fields": ("name", "slug", "is_active")
        }),
        ("Approval Status", {
            "fields": (
                "status",
                "created_by",
                "approved_by",
                "approved_at",
                "rejection_reason"
            )
        }),
        ("Timestamps", {
            "fields": ("created_at",)
        }),
    )
    
    actions = ["approve_companies", "reject_companies", "suspend_companies"]
    
    def status_badge(self, obj):
        """Display status with color badge."""
        colors = {
            "pending": "#FFA500",  # Orange
            "active": "#28a745",   # Green
            "rejected": "#dc3545", # Red
            "suspended": "#6c757d" # Gray
        }
        color = colors.get(obj.status, "#000")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = "Status"
    
    @admin.action(description="✅ Approve selected companies")
    def approve_companies(self, request, queryset):
        """Bulk approve companies."""
        count = 0
        for company in queryset.filter(status=Company.Status.PENDING):
            company.approve(request.user)
            count += 1
        
        self.message_user(
            request,
            f"Successfully approved {count} companies."
        )
    
    @admin.action(description="❌ Reject selected companies")
    def reject_companies(self, request, queryset):
        """Bulk reject companies."""
        count = 0
        for company in queryset.filter(status=Company.Status.PENDING):
            company.reject(request.user, reason="Rejected via bulk action")
            count += 1
        
        self.message_user(
            request,
            f"Successfully rejected {count} companies.",
            level="warning"
        )
    
    @admin.action(description="⏸️ Suspend selected companies")
    def suspend_companies(self, request, queryset):
        """Bulk suspend companies."""
        count = 0
        for company in queryset.filter(status=Company.Status.ACTIVE):
            company.suspend()
            count += 1
        
        self.message_user(
            request,
            f"Successfully suspended {count} companies.",
            level="warning"
        )

