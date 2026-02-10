from django.db import models
from django.utils import timezone

class Review(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    student_name = models.CharField(max_length=255)
    batch = models.CharField(max_length=100, blank=True, null=True)
    module = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending')
    scheduled_at = models.DateTimeField(default=timezone.now)
    scores = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, null=True)
    session_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student_name} - {self.module}"

    class Meta:
        db_table = 'reviews' # Ensure it matches our existing table if we want to reuse data, though I'll likely just migrate
        ordering = ['-scheduled_at']
