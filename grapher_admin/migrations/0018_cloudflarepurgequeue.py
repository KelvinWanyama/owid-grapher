# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-09-15 10:29
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('grapher_admin', '0017_auto_20170915_1024'),
    ]

    operations = [
        migrations.CreateModel(
            name='CloudflarePurgeQueue',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('url', models.CharField(max_length=255, unique=True)),
            ],
        ),
    ]