from django.db import models
from django.apps import apps
from companies.permissions import require_active_company


class Lead(models.Model):
    class Source(models.TextChoices):
        WEB = "web", "Web"
        CALL = "call", "Llamada"
        WHATSAPP = "whatsapp", "WhatsApp"
        OTHER = "other", "Otro"

    class Stage(models.TextChoices):
        NEW = "new", "Nuevo"
        CONTACTED = "contacted", "Contactado"
        APPOINTMENT = "appointment", "Cita"
        SOLD = "sold", "Venta"
        LOST = "lost", "Perdido"

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="leads",
    )

    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)

    source = models.CharField(max_length=20, choices=Source.choices, default=Source.WEB)
    stage = models.CharField(max_length=20, choices=Stage.choices, default=Stage.NEW)

    vehicle = models.ForeignKey(
        "inventory.Vehicle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Lead"
        verbose_name_plural = "Leads"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """
        Crea una Activity automática cuando cambia el stage (si el Lead ya existía).
        Esto cubre cambios manuales en Admin y cambios desde API futura que usen save().

        IMPORTANTE:
        - No se ejecuta en queryset.update() / bulk_update().
        - Validates that company is active before saving.
        """
        # Allow superusers to bypass check (for migrations, admin fixes, etc.)
        bypass_check = kwargs.pop('bypass_company_check', False)
        
        if not bypass_check and self.company_id:
            # Fetch company if not already loaded
            if not hasattr(self, '_company_cache'):
                from companies.models import Company
                company = Company.objects.get(pk=self.company_id)
            else:
                company = self.company
            require_active_company(company)
        
        old_stage = None
        creating = self.pk is None

        if not creating:
            old_stage = (
                Lead.objects.filter(pk=self.pk)
                .values_list("stage", flat=True)
                .first()
            )

        super().save(*args, **kwargs)

        # Si era creación, no registramos "cambio de stage"
        if creating:
            return

        # Si no encontramos el old_stage (raro), no hacemos nada
        if old_stage is None:
            return

        # Si no ha cambiado, no hacemos nada
        if old_stage == self.stage:
            return

        # Crear Activity automática
        ActivityModel = apps.get_model("leads", "Activity")

        old_label = Lead.Stage(old_stage).label if old_stage in Lead.Stage.values else old_stage
        new_label = self.get_stage_display()

        ActivityModel.objects.create(
            lead=self,
            type=ActivityModel.Type.NOTE,
            text=f"Estado cambiado de {old_label} a {new_label}.",
        )


class Activity(models.Model):
    class Type(models.TextChoices):
        NOTE = "note", "Nota"
        CALL = "call", "Llamada"
        WHATSAPP = "whatsapp", "WhatsApp"
        EMAIL = "email", "Email"

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="activities",
    )

    type = models.CharField(max_length=20, choices=Type.choices, default=Type.NOTE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Activity"
        verbose_name_plural = "Activities"

    def __str__(self):
        return f"{self.get_type_display()} - {self.lead}"
