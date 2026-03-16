from django.db import models
from django.conf import settings


class WriterProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="writer_profile",
    )
    about = models.TextField(blank=True, default="")

    def __str__(self):
        return f"WriterProfile<{self.user.username}>"
