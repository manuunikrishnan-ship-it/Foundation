from rest_framework import serializers
from .models import Review

class ReviewSerializer(serializers.ModelSerializer):
    studentName = serializers.CharField(source='student_name')
    scheduledAt = serializers.DateTimeField(source='scheduled_at', required=False)
    sessionData = serializers.JSONField(source='session_data', required=False)
    
    class Meta:
        model = Review
        fields = ['id', 'studentName', 'batch', 'module', 'status', 'scheduledAt', 'scores', 'notes', 'sessionData', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
