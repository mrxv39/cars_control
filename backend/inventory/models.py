from django.db import models
from companies.models import Company
from companies.permissions import require_active_company


class Vehicle(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Disponible"
        RESERVED = "RESERVED", "Reservado"
        SOLD = "SOLD", "Vendido"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vehicles")

    make = models.CharField(max_length=80)     # marca
    model = models.CharField(max_length=80)    # modelo
    year = models.PositiveIntegerField()
    mileage_km = models.PositiveIntegerField(default=0)

    fuel = models.CharField(max_length=30, blank=True)          # gasolina/diesel/etc
    transmission = models.CharField(max_length=30, blank=True)  # manual/auto
    price_eur = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.AVAILABLE)

    title = models.CharField(max_length=140, blank=True)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.make} {self.model} ({self.year})"

    def save(self, *args, **kwargs):
        """
        Validate that company is active before saving.
        """
        # Allow superusers to bypass check (for migrations, admin fixes, etc.)
        bypass_check = kwargs.pop('bypass_company_check', False)
        
        if not bypass_check and self.company_id:
            # Fetch company if not already loaded
            if not hasattr(self, '_company_cache'):
                self.company.refresh_from_db()
            require_active_company(self.company)
        
        super().save(*args, **kwargs)


class VehiclePhoto(models.Model):
    vehicle = models.ForeignKey(Vehicle, related_name="photos", on_delete=models.CASCADE)
    image = models.ImageField(upload_to="vehicles/%Y/%m/")
    sort_order = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Photo {self.id} for vehicle {self.vehicle_id}"
