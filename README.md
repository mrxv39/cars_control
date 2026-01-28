# Cars Control

Sistema de control de vehículos desarrollado con Django.

## Estructura del proyecto

```
cars_control/
├── backend/           # Backend Django
│   ├── cars_control/  # Configuración del proyecto
│   ├── manage.py      # Utilidad de administración Django
│   └── requirements.txt
└── README.md
```

## Instalación

```bash
# Crear entorno virtual
python -m venv .venv
.venv\Scripts\activate  # En Windows
source .venv/bin/activate  # En Linux/Mac

# Instalar dependencias
cd backend
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env

# Ejecutar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser
```

## Ejecutar servidor de desarrollo

```bash
cd backend
python manage.py runserver
```

Acceder a:
- Aplicación: http://127.0.0.1:8000/
- Admin: http://127.0.0.1:8000/admin/

## Tecnologías

- Django 5.1.6
- Django REST Framework
- SQLite (desarrollo)
- Python 3.14
