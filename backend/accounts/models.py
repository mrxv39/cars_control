from django.conf import settings
from django.db import models
from companies.models import Company

User = settings.AUTH_USER_MODEL

class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        ADMIN = "ADMIN", "Admin"
        SALES = "SALES", "Sales"

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.SALES)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "company")

    def __str__(self):
        return f"{self.user} @ {self.company} ({self.role})"
