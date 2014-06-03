import re

from django.db import models
from django.contrib.auth.models import User

from anylist.settings import MEDIA_ROOT, MEDIA_URL, STATICFILES_DIRS


class GenreGroup(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def _genres(self):
        return Genre.objects.filter(group=self.id)
    genres = property(_genres)
    @genres.setter
    def set_genres(self, value):
        self.genres = value

    def __str__(self):
        return self.name


class Raiting(models.Model):
    name = models.CharField(max_length=8, unique=True)

    def __str__(self):
        return self.name

class Genre(models.Model):
    name = models.CharField(max_length=140, unique=True)
    group = models.ForeignKey(GenreGroup)

    def __str__(self):
        return self.name


class ThematicGroup(models.Model):
    ''' Разделы сайта, объединенниые в группы '''
    name = models.CharField(max_length=50, unique=True)

    def _children(self):
        return Category.objects.filter(group=self.id)
    children = property(_children)

    def __str__(self):
        return self.name


class Category(models.Model):
    ''' Здесь мы перечисляем названия разделов сайта '''
    name = models.CharField(max_length=40, unique=True) # на английском
    avatar = models.FileField(upload_to=MEDIA_ROOT)
    group = models.ForeignKey(ThematicGroup)

    def get_absolute_url(self):
        return self.name.lower()

    def __str__(self):
        return self.name

    def avatar_path(self):
        return '/static/' + str(self.avatar).split('/')[-1]


class Production(models.Model):
    title = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True)
    avatar = models.FileField(upload_to=MEDIA_ROOT)

    genres = models.ManyToManyField(Genre)
    old_limit = models.ForeignKey(Raiting)

    def avatar_path(self):
        return '/media/' + str(self.avatar).split('/')[-1]

    def get_absolute_url(self):
        return '%i-%s' % (self.id, self.title.replace(" ", "_").replace("-", "_"))

    def __str__(self):
        return self.title


# Таблица персонажей одна для всех, уникальные черты
# будут доступны через связи с ней
# пока не используется
class Hero(models.Model):
    full_name = models.CharField(max_length=255)
    avatar = models.FileField(upload_to=MEDIA_ROOT)
    description = models.TextField()


class Anime(models.Model):
    link = models.OneToOneField(Production)

    def __str__(self):
        return self.link.title


class Manga(models.Model):
    link = models.OneToOneField(Production)

    def __str__(self):
        return self.link.title


class SeriesGroup(models.Model):
    number = models.PositiveSmallIntegerField(default=1)
    name = models.CharField(max_length=255, null=True)
    product = models.ForeignKey(Production)

    def _series(self):
        return Serie.objects.filter(season=self.id)
    series = property(_series)

    def __str__(self):
        return '%i-%s' % (self.number, self.product.title)

    class Meta:
        ordering = ['-number']


class Serie(models.Model):
    number = models.IntegerField()
    name = models.CharField(max_length=255)
    season = models.ForeignKey(SeriesGroup)
    start_date = models.DateTimeField(null=True)
    length = models.IntegerField(null=True)

    def __str__(self):
        return "%i-%s" % (self.number, self.name)

    class Meta:
        ordering = ['-number']