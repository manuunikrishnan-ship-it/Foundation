from rest_framework import viewsets
from .models import Review
from .serializers import ReviewSerializer
from rest_framework.decorators import action
from rest_framework.response import Response

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().order_by('-scheduled_at')
    serializer_class = ReviewSerializer

    @action(detail=False, methods=['GET'])
    def test(self, request):
        return Response({'status': 'ok'})
