from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0009_search_headings_and_search_index"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="faq_blocks",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
