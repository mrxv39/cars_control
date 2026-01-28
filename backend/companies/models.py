from django.db import models


class Company(models.Model):
    """
    Modelo que representa una empresa/concesionario en el sistema SaaS.
    Cada empresa tiene su propio espacio aislado de datos.
    """
    name = models.CharField(max_length=255, verbose_name="Nombre")
    slug = models.SlugField(unique=True, verbose_name="Slug")
    is_active = models.BooleanField(default=True, verbose_name="Activa")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")

    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"
        ordering = ['-created_at']

    def __str__(self):
        return self.name
