# Backend - Cars Control

API backend para el sistema de control de vehículos con Django.

## Instalación

```bash
# Desde la raíz del proyecto
python -m venv .venv
.venv\Scripts\activate

# Instalar dependencias
cd backend
pip install -r requirements.txt
```

## Configuración

1. Copiar `.env.example` a `.env` y configurar las variables
2. Ejecutar migraciones:

```bash
python manage.py migrate
```

## Ejecutar servidor de desarrollo

```bash
python manage.py runserver
```

El servidor estará disponible en: http://127.0.0.1:8000/
