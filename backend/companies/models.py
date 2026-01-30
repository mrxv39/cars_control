from django.conf import settings
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class Company(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        REJECTED = "rejected", "Rejected"
        SUSPENDED = "suspended", "Suspended"

    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    
    # Legacy field - kept for backwards compatibility
    is_active = models.BooleanField(default=True)
    
    # New approval workflow fields
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.PENDING,
        db_index=True
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="companies_created"
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="companies_approved"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Company"
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name

    def is_company_active(self) -> bool:
        """Check if company can perform operations (create/update/delete resources)."""
        return self.status == self.Status.ACTIVE

    def approve(self, by_user) -> None:
        """Approve the company and activate it."""
        self.status = self.Status.ACTIVE
        self.approved_by = by_user
        self.approved_at = timezone.now()
        self.save()

    def reject(self, by_user, reason: str = "") -> None:
        """Reject the company application."""
        self.status = self.Status.REJECTED
        self.approved_by = by_user
        self.approved_at = timezone.now()
        self.rejection_reason = reason
        self.save()

    def suspend(self) -> None:
        """Suspend an active company."""
        self.status = self.Status.SUSPENDED
        self.save()
