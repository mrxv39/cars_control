from django.contrib import admin, messages
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.utils import timezone

from .models import Lead, Activity
from accounts.models import Membership
from companies.permissions import CompanyNotActiveError, require_active_company


def get_user_company(user):
    membership = (
        Membership.objects.select_related("company")
        .filter(user=user)
        .order_by("id")
        .first()
    )
    return membership.company if membership else None


def is_owner(user):
    return Membership.objects.filter(user=user, role=Membership.Role.OWNER).exists()


def _bulk_set_stage_with_activity(*, request, queryset, new_stage, activity_text):
    """
    Cambia el stage y crea una Activity automática por Lead.
    """
    leads = list(queryset)

    if not leads:
        messages.info(request, "No hay leads seleccionados.")
        return

    # 1) Cambiar stage
    for lead in leads:
        lead.stage = new_stage
    Lead.objects.bulk_update(leads, ["stage"])

    # 2) Crear activities
    now = timezone.now()
    activities = [
        Activity(
            lead=lead,
            type=Activity.Type.NOTE,
            text=activity_text,
            # Si created_at es auto_now_add, Django lo pondrá automáticamente.
            created_at=now,
        )
        for lead in leads
    ]
    Activity.objects.bulk_create(activities)

    messages.success(request, f"{len(leads)} lead(s): estado actualizado y actividad creada.")


# =========================
# Admin Actions
# =========================

@admin.action(description="➡ Marcar como Contactado (y registrar actividad)")
def mark_as_contacted(modeladmin, request, queryset):
    _bulk_set_stage_with_activity(
        request=request,
        queryset=queryset,
        new_stage=Lead.Stage.CONTACTED,
        activity_text="Estado cambiado a Contactado (acción rápida).",
    )


@admin.action(description="📅 Marcar como Cita (y registrar actividad)")
def mark_as_appointment(modeladmin, request, queryset):
    _bulk_set_stage_with_activity(
        request=request,
        queryset=queryset,
        new_stage=Lead.Stage.APPOINTMENT,
        activity_text="Estado cambiado a Cita (acción rápida).",
    )


@admin.action(description="💰 Marcar como Venta (y registrar actividad)")
def mark_as_sold(modeladmin, request, queryset):
    _bulk_set_stage_with_activity(
        request=request,
        queryset=queryset,
        new_stage=Lead.Stage.SOLD,
        activity_text="Estado cambiado a Venta (acción rápida).",
    )


@admin.action(description="❌ Marcar como Perdido (y registrar actividad)")
def mark_as_lost(modeladmin, request, queryset):
    _bulk_set_stage_with_activity(
        request=request,
        queryset=queryset,
        new_stage=Lead.Stage.LOST,
        activity_text="Estado cambiado a Perdido (acción rápida).",
    )


# =========================
# Inlines
# =========================

class ActivityInline(admin.TabularInline):
    model = Activity
    extra = 0
    fields = ("type", "text", "created_at")
    readonly_fields = ("created_at",)
    can_delete = False  # ✅ QUITA la columna "Delete" del inline


# =========================
# Admins
# =========================

@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "phone",
        "email",
        "source",
        "stage",
        "vehicle",
        "company",
        "created_at",
    )
    list_filter = ("source", "stage")
    search_fields = ("name", "phone", "email")
    readonly_fields = ("company", "created_at")
    inlines = [ActivityInline]

    actions = [
        mark_as_contacted,
        mark_as_appointment,
        mark_as_sold,
        mark_as_lost,
    ]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs

        company = get_user_company(request.user)
        return qs.none() if company is None else qs.filter(company=company)

    def save_model(self, request, obj, form, change):
        """
        Auto-assign company to lead when creating.
        Enforces that company must be active to create/update leads.
        """
        if not request.user.is_superuser and not obj.pk:
            company = get_user_company(request.user)
            if company is None:
                raise ObjectDoesNotExist("El usuario no tiene Membership.")
            
            # Enforce active company requirement
            try:
                require_active_company(company)
            except CompanyNotActiveError as e:
                raise PermissionDenied(str(e))
            
            obj.company = company
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_owner(request.user)


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("lead", "type", "created_at")
    search_fields = ("lead__name", "text")
    readonly_fields = ("created_at",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs

        company = get_user_company(request.user)
        return qs.none() if company is None else qs.filter(lead__company=company)

    def has_delete_permission(self, request, obj=None):
        # No borrar Activities sueltas
        return False
