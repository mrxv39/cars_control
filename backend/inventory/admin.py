from django.contrib import admin
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied

from accounts.models import Membership
from inventory.models import Vehicle, VehiclePhoto
from leads.models import Lead
from companies.permissions import CompanyNotActiveError, require_active_company


def get_user_company(user):
    """
    Regla del proyecto: 1 usuario = 1 empresa.
    Si no hay membership, devolvemos None para evitar crashes.
    """
    membership = (
        Membership.objects.select_related("company")
        .filter(user=user)
        .order_by("id")
        .first()
    )
    return membership.company if membership else None


class VehiclePhotoInline(admin.TabularInline):
    model = VehiclePhoto
    extra = 0


class LeadInline(admin.TabularInline):
    """
    Permite crear Leads directamente desde el Vehículo.
    El lead queda vinculado al vehículo (por ser inline) y a la company del usuario (en save_formset).
    """
    model = Lead
    extra = 0
    fields = ("name", "phone", "email", "source", "stage", "created_at", "company")
    readonly_fields = ("created_at", "company")
    show_change_link = True


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    inlines = [VehiclePhotoInline, LeadInline]

    # IMPORTANT: No ponemos list_display/fields porque no conocemos tus campos exactos.
    # Esto evita errores si tu Vehicle no tiene esos campos.

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs

        company = get_user_company(request.user)
        return qs.none() if company is None else qs.filter(company=company)

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        # company siempre visible solo lectura para usuarios normales
        if not request.user.is_superuser:
            if "company" not in ro:
                ro.append("company")
        return ro

    def save_model(self, request, obj, form, change):
        """
        Auto-asignar company al crear/editar (para comerciales).
        Evita que puedan mover vehículos entre empresas.
        Enforces that company must be active to create/update vehicles.
        """
        if not request.user.is_superuser:
            company = get_user_company(request.user)
            if company is None:
                raise ObjectDoesNotExist("El usuario no tiene Membership asignado.")
            
            # Enforce active company requirement
            try:
                require_active_company(company)
            except CompanyNotActiveError as e:
                raise PermissionDenied(str(e))
            
            obj.company = company
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        """
        Aquí forzamos la company en los Leads creados desde el inline del Vehicle.
        Enforces that company must be active to create leads from inline.
        """
        instances = formset.save(commit=False)

        # Detectar si este formset es el de Leads
        is_lead_formset = getattr(formset, "model", None) == Lead

        if is_lead_formset and not request.user.is_superuser:
            company = get_user_company(request.user)
            if company is None:
                raise ObjectDoesNotExist("El usuario no tiene Membership asignado.")

            # Enforce active company requirement
            try:
                require_active_company(company)
            except CompanyNotActiveError as e:
                raise PermissionDenied(str(e))

            for obj in instances:
                # Vehicle lo asigna Django automáticamente por ser inline.
                # Solo forzamos company.
                obj.company = company
                obj.save()
        else:
            for obj in instances:
                obj.save()

        formset.save_m2m()


@admin.register(VehiclePhoto)
class VehiclePhotoAdmin(admin.ModelAdmin):
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs

        company = get_user_company(request.user)
        return qs.none() if company is None else qs.filter(vehicle__company=company)
