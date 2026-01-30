from django.urls import path
from .inbound_views import inbound_lead_from_gmail

urlpatterns = [
    path("inbound/leads/gmail/", inbound_lead_from_gmail, name="inbound_lead_from_gmail"),
]
