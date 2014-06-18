# -*- encoding: utf-8 -*-
import json
import logging
import re

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.formtools.wizard.views import SessionWizardView
from django.core.cache import cache
from django.db.models import F
from django.http import HttpResponseRedirect, HttpResponse, HttpResponseServerError, HttpResponseNotFound
from django.shortcuts import render_to_response, render
from django.views.decorators.http import require_http_methods
from django.views.generic import TemplateView, ListView
from django.views.generic.edit import CreateView, FormView, UpdateView
from django.views.generic.detail import DetailView

from braces.views import LoginRequiredMixin

from apps.models import *
from apps.forms import *
from apps.serializers import ProductSerializer

from .mixins import *


logger = logging.getLogger(__name__)
Types = {'anime': Anime, 'manga': Manga}

#------------ Base Views -----------------
class MainPage(ListView):
    model = ThematicGroup
    template_name = 'index.html'


@require_http_methods(['GET'])
def search(request):
    ''' Простейший поиск по названиям произведений '''
    result = dict(map(
        lambda item:
        (item.title, '/' + item.get_category() + '/' + item.get_absolute_url()),
        Production.objects.filter(Q(title__icontains=request.GET['key']))
    ))

    return HttpResponse(
        json.dumps(result), content_type='application/json')


@login_required(login_url='/')
@require_http_methods(['GET'])
def profile(request):
    ''' страница профиля пользователя '''
    result = {}
    result['category'] = Category.objects.all()
    st = Status.objects.all()
    for cat in result['category']:
        status = [item for item in st]
        values = []
        cat.status = []
        for item in status:
            kwargs = {'status__name': item}
            k = F('product__%s__link' % cat.name.lower())
            kwargs['product'] = k
            cat.status.append({'name': item, 'count': 
                ListedProduct.objects.filter(**kwargs).count()})
    return render(request, 'profile.html', result)


@require_http_methods(['POST'])
def add_list_serie(request):
    ''' добаваляем серию в список просмотренных '''
    try:
        p = Serie.objects.get(number=request.POST['number'],
            season__product__id=request.POST['product'],
            season__number=request.POST['season']
        )
        product = ListedProduct.objects.get(
            product__id=request.POST['product'], user=request.user)
        product.series.add(p)
        return HttpResponse("ok")
    except Exception as e:
        print(e)
        return HttpResponseServerError()


def del_list_serie(request):
    try:
        cd = {}
        for key in request.POST.keys():
            cd[key] = re.search(r'(\d+)', request.POST[key]).group()
        p = Serie.objects.get(number=cd['number'],
            season__product=cd['product'],
            season__number=cd['season']
        )
        product = ListedProduct.objects.get(product=cd['product'])
        product.series.remove(p)
        return HttpResponse('Ok')
    except Exception as e:
        print(e)
        return HttpResponseServerError()


class UserList(LoginRequiredMixin, ListView):
    ''' список произведений, составленный пользователем '''
    template_name = 'user_list.html'

    def get_queryset(self):
        # Так мы делаем первую букву заглавной
        status = self.kwargs['status'][:1].upper() +\
            self.kwargs['status'][1:]
        self.queryset = ListedProduct.objects.filter(
            product=F('product__%s__link' % self.kwargs['category']),
            status__name=status
        )
        return self.queryset

    def get_context_data(self, **kwargs):
        context = super(UserList, self).get_context_data(**kwargs)

        category = self.kwargs['category'][:1].upper() +\
            self.kwargs['category'][1:]

        context['category'] = Category.objects.get(
            name=category).get_absolute_url()
        context['status'] = Status.objects.all()
        return context


@require_http_methods(['POST'])
def add_list(request):
    ''' Добавляем произведение в список '''
    cd = request.POST.copy()
    cd['status'] = 1    # запланировано
    cd['user'] = request.user.id
    form = AddToListForm(cd)
    if form.is_valid():
        form.save()
        return HttpResponse('success')
    return HttpResponse(str(form))


class ProductionList(ListPageMixin, ListView):
    genre_groups =\
        ['Anime Male', 'Anime Female', 'Standart', 'Anime Porn', 'Anime School']

    def dispatch(self, *args, **kwargs):
        if 'category' not in kwargs or kwargs['category'] not in Types:
            return HttpResponseNotFound('<h1>Page not Found</h1>')
        else:
            return super(ProductionList, self).dispatch(*args, **kwargs)


def status_update(request, pk):
    ''' Меняем статус просмотра произведения '''
    p = ListedProduct.objects.get(user=request.user, product__id=pk)
    p.status=Status.objects.get(name=request.POST['name'])
    p.save()
    return HttpResponse('Ok')


def remove_from_list(request, pk):
    ListedProduct.objects.filter(user=request.user, product__id=pk).delete()
    return HttpResponse('Ok')


class ProductDetail(DetailView):
    model = Production
    template_name = 'detail.html'

    def dispatch(self, *args, **kwargs):
        if 'pk' not in kwargs:
            return HttpResponseNotFound('<h1>PageNotFound</h1>')
        else:
            return super(ProductDetail, self).dispatch(*args, **kwargs)


    def get_context_data(self, **kwargs):
        context = super(ProductDetail, self).get_context_data(**kwargs)
        context['header'] = context['object'].title
        context['category'] = self.kwargs['category']
        context['is_listed'] = ListedProduct.objects.filter(
            user=self.request.user.id, product__title=context['object'].title
            ).first()
        return context


class ProductionEdit(UpdateView):
    template_name = 'forms/edit_form.html'
    model = Production

    success_url = '/manga/'

    def get_context_data(self, **kwargs):
        context = super(ProductionEdit, self).get_context_data(**kwargs)

        context['genres'] = Genre.objects.all()
        context['header'] = 'Edit %s' % self.kwargs['category']
        context['use_genres'] = json.dumps(
            [str(item.name) for item in context['object'].genres.all()],
            ensure_ascii=False
        )
        context['raiting'] = Raiting.objects.all()
        return context


@require_http_methods(['POST'])
def add_serie(request, category, pk):
    ''' Добавляем новую серию в указанный сезон '''
    try:
        cd = request.POST.copy()
        pk = Production.objects.get(id=pk)
        p = SeriesGroup.objects.get_or_create(product=pk, number=cd['season'])

        # если ещё нет ни одного сезона, то срабатывает create, возвращающий кортеж
        if isinstance(p, tuple):
            p = p[0]
        cd['season'] = p.id

        form = AddSerieForm(cd)
        if form.is_valid():
            form.save()
            return HttpResponse('success')
        return HttpResponse('Invalid form data')
    except Exception as e:
        logger.error(e)
        return HttpResponseServerError()


def edit_serie(request):
    cd = request.POST.copy()
    g = SeriesGroup.objects.get(product=cd['product'], number=int(cd['season']))
    old = cd['ident']   # номер той серии, что мы правим
    cd['season'] = g.id     # id сезона
    form = AddSerieForm(cd)
    if form.is_valid():
        cd = form.cleaned_data
        Serie.objects.filter(number=old, season=g.id).update(**cd)
        return HttpResponse('success')
    result = json.dumps([item for item in form.errors.keys()])
    return HttpResponse(result)


@require_http_methods(['POST', 'GET'])
def auth1(request, url):
    url = "/%s" % url
    username = request.POST['username']
    password = request.POST['password']
    user = authenticate(username=username, password=password)
    if user:
        if user.is_active:
            login(request, user)
            return HttpResponseRedirect(url)
        else:
            return HttpResponse('Account Disabled')
    else:
        return HttpResponse('Username or password incorrect')


@require_http_methods(['POST', 'GET'])
def register(request, url):
    if request.POST:
        form = RegisterForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            user = User.objects.create_user(**cd)
            user.save()
            return auth1(request, url)
        return HttpResponse(str(form))
    else:
        return HttpResponseRedirect('/%s' % url)


@require_http_methods(['POST', 'GET'])
def auth(request, url):
    if request.POST:
        form = LoginForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            user = User.objects.get(username=cd['username'])
            return auth1(request, url)
        return HttpResponse(str(form))
    else:
        return HttpResponseRedirect('/%s' % url)


@require_http_methods(['POST', 'GET'])
def log_out(request, url):
    logout(request)
    if 'profile' in url:
        return HttpResponseRedirect('/')
    return HttpResponseRedirect('/' + url)


class AddProduct(LoginRequiredMixin, BasePageMixin, CreateView):
    template_name = 'forms/add_form.html'
    model = Production
    form_class = AddForm    

    def get_success_url(self):
        try:
            p = Production.objects.last()
            Types[self.kwargs['category']].objects.create(link=p)
            return '/%s/' % self.kwargs['category']
        except Exception as e:
            logger.error(e)
            raise
    
    def get_context_data(self, **kwargs):
        context = super(AddProduct, self).get_context_data(**kwargs)

        context['genres'] = Genre.objects.all()
        context['header'] = 'Create new %s' % self.kwargs.get('category')
        context['raiting'] = Raiting.objects.all()

        return context


@require_http_methods(['POST'])
def add_manga_vol(request):
    ''' Т.к у манги несколько томов (SeriesGroup), то
    кнопка добавления серии появляется возле каждого конкретного
    тома '''
    cd = request.POST.copy()
    cd['number'] = SeriesGroup.objects.filter(
        product=cd['product']).last() or 1
    if cd['number'] != 1:
        cd['number'] = cd['number'].number + 1
    form = AddMangaVolumeForm(cd)
    if form.is_valid():
        form.save()
        return HttpResponse('success')
    return HttpResponse(str(form))


@require_http_methods(['GET'])
def production_series_view(request, category, pk):
    try:
        result = {}
        result['nav_groups'] = ThematicGroup.objects.all()
        return render(request, 'series.html', result)
    except Exception as e:
        logger.error(e)
        return HttpResponseServerError()


@require_http_methods(['GET'])
def seasons_view(request, category, pk):
    try:
        js = []
        for item in SeriesGroup.objects.filter(product=pk):
            js.append({'number': item.number, 'name': item.name, 'series':
                [{'number': elem.number, 'name': elem.name,
                    'start_date': str(elem.start_date).split('+')[0][:-3],
                    'length': elem.length, 'id': elem.id}
                    for elem in item.series]
            })
        if request.user.is_authenticated():
            listed = [i.id for item in
                ListedProduct.objects.filter(user=request.user, product=pk)
                for i in item.series.all()]
            for season in js:
                for serie in season['series']:
                    if serie['id'] in listed:
                        serie['listed'] = 'Удалить из списка'
                    else:
                        serie['listed'] = 'Добавить в список'
                    serie['imgUrl'] = '/static/edit.png'
        for season in js:
            for serie in season['series']:
                del serie['id']
        return HttpResponse(json.dumps(js, ensure_ascii=False), content_type='application/json')
    except Exception as e:
        logger.error(e)
        return HttpResponseServerError()


class ProductionChoiceView(BaseChoiceMixin, ListView):
    model = Production
    template_name = 'list.html'
    header = 'Выборка манги по жанрам'
    category = 'Manga'
    genre_groups =\
        ['Anime Male', 'Anime Female', 'Anime School', 'Standart', 'Anime Porn']
    model1 = Manga
