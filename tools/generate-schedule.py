# -*- coding: utf-8 -*-
import html

CLASSES = {
 'Reformer Flow':        ('reformer','Reformer Pilates','45 min','All levels',
   'Spring-loaded, low impact, relentless. A full-body flow on the carriage with hands-on corrections from the front of the room.'),
 'Reformer Foundations': ('reformer','Reformer Pilates','45 min','Beginners',
   'The one to start with. We walk you round the machine, explain what the springs actually do, and nobody expects you to know anything.'),
 'Reformer Strong':      ('reformer','Reformer Pilates','45 min','Intermediate',
   'Heavier springs, slower tempo, longer holds. You will feel this one in your hamstrings for two days.'),
 'Barre':                ('barre','Barre','45 min','All levels',
   'Ballet-adjacent and genuinely evil. Movements about one centimetre wide. Your legs will shake, and so will everyone else’s.'),
 'Vinyasa':              ('yoga','Yoga','60 min','All levels',
   'Breath-led and unhurried, in the low morning light. Strong enough to wake you up properly, gentle enough to go to work after.'),
 'Slow Flow':            ('yoga','Yoga','60 min','All levels',
   'Long holds, fewer shapes, more floor. The antidote to a day spent looking at screens.'),
 'Restorative':          ('yoga','Yoga','60 min','All levels',
   'Almost entirely on the floor, with bolsters and blankets. Bring socks. Nobody will make you chant.'),
 'Candlelit Restorative':('yoga','Yoga','60 min','All levels',
   'Sunday evening, lights off, candles on. The quietest hour of the week, and the one that fills up first.'),
}

WEEK = [
 ('Mon','14 Sep',[('07:30','Vinyasa','Rea','4 spots left'),
                  ('09:00','Reformer Flow','Elira','2 spots left'),
                  ('12:30','Barre','Arta','6 spots left'),
                  ('18:00','Reformer Flow','Elira','Full'),
                  ('19:15','Slow Flow','Ilda','5 spots left')]),
 ('Tue','15 Sep',[('07:30','Reformer Flow','Jona','3 spots left'),
                  ('09:00','Barre','Arta','7 spots left'),
                  ('12:30','Reformer Foundations','Elira','4 spots left'),
                  ('18:00','Reformer Strong','Megi','1 spot left'),
                  ('19:15','Vinyasa','Rea','8 spots left')]),
 ('Wed','16 Sep',[('07:30','Vinyasa','Rea','6 spots left'),
                  ('09:00','Reformer Flow','Elira','3 spots left'),
                  ('12:30','Barre','Megi','5 spots left'),
                  ('18:00','Reformer Flow','Jona','Full'),
                  ('19:15','Restorative','Ilda','9 spots left')]),
 ('Thu','17 Sep',[('07:30','Reformer Flow','Elira','5 spots left'),
                  ('09:00','Slow Flow','Ilda','7 spots left'),
                  ('12:30','Barre','Arta','4 spots left'),
                  ('18:00','Reformer Strong','Megi','2 spots left'),
                  ('19:15','Reformer Flow','Jona','3 spots left')]),
 ('Fri','18 Sep',[('07:30','Vinyasa','Rea','6 spots left'),
                  ('09:00','Reformer Flow','Elira','4 spots left'),
                  ('12:30','Reformer Foundations','Jona','6 spots left'),
                  ('18:00','Barre','Arta','2 spots left'),
                  ('19:15','Slow Flow','Ilda','8 spots left')]),
 ('Sat','19 Sep',[('09:00','Reformer Flow','Elira','3 spots left'),
                  ('10:30','Barre','Megi','5 spots left'),
                  ('12:00','Vinyasa','Rea','7 spots left')]),
 ('Sun','20 Sep',[('09:30','Slow Flow','Ilda','6 spots left'),
                  ('11:00','Reformer Foundations','Jona','4 spots left'),
                  ('18:00','Candlelit Restorative','Ilda','Full')]),
]

ROLES = {'Elira':'Lead reformer instructor','Jona':'Reformer instructor',
         'Arta':'Barre instructor','Megi':'Reformer & barre instructor',
         'Rea':'Yoga instructor','Ilda':'Yoga & recovery'}
FULLNAME = {'Mon':'Monday','Tue':'Tuesday','Wed':'Wednesday','Thu':'Thursday',
            'Fri':'Friday','Sat':'Saturday','Sun':'Sunday'}

def e(t): return html.escape(t, quote=True)

days_html, tabs = [], []
for short, date, rows in WEEK:
    cells = []
    for time, name, who, spots in rows:
        disc, service, dur, level, note = CLASSES[name]
        full = spots == 'Full'
        cells.append(
f'''          <button class="cls cls--{disc}{' is-full' if full else ''}" type="button"
            data-when="{e(FULLNAME[short])} {e(date)} · {e(time)}" data-name="{e(name)}"
            data-instructor="{e(who)}" data-role="{e(ROLES[who])}" data-dur="{e(dur)}"
            data-level="{e(level)}" data-spots="{e('Full — join the waitlist' if full else spots)}"
            data-note="{e(note)}" data-service="{e(service)}">
            <span class="cls__time">{time}</span>
            <span class="cls__name">{e(name)}</span>
            <span class="cls__who">{e(who)}</span>
          </button>''')
    days_html.append(
f'''      <div class="day" data-day="{short}">
        <h3 class="day__name"><b>{short}</b><span>{date}</span></h3>
        <div class="day__list">
{chr(10).join(cells)}
        </div>
      </div>''')
    tabs.append(f'<button class="tab" type="button" data-tab="{short}"><b>{short}</b><i>{date.split()[0]}</i></button>')

SECTION = f'''
<!-- ───────────────────────────── 6. SCHEDULE ───────────────────────────── -->
<section class="sched" id="schedule">
  <div class="sched__inner">
    <div class="sched__head">
      <div>
        <p class="eyebrow" data-reveal><span>05 — The week</span></p>
        <h2 class="display display--lg" data-reveal-lines>
          <span class="line"><span>This week</span></span>
          <span class="line"><span>at <em>DUA.</em></span></span>
        </h2>
      </div>
      <div class="sched__note">
        <p data-reveal>Tap any class for the instructor, the level and what is left. Booking opens seven days ahead, and the 18:00 reformer always goes first.</p>
        <ul class="key" data-reveal>
          <li><i class="key__dot key__dot--r"></i>Reformer</li>
          <li><i class="key__dot key__dot--b"></i>Barre</li>
          <li><i class="key__dot key__dot--y"></i>Yoga</li>
        </ul>
      </div>
    </div>

    <div class="sched__tabs" id="sched-tabs" aria-label="Choose a day" hidden>
      {chr(10)      .join('  '+t for t in tabs)}
    </div>

    <div class="sched__grid">
{chr(10).join(days_html)}
    </div>
  </div>
</section>
'''

OVERLAY = '''
<!-- ───────────────────────────── CLASS DETAIL ───────────────────────────── -->
<div class="cinfo" id="classinfo" hidden>
  <div class="cinfo__scrim" data-cinfo-close></div>
  <div class="cinfo__panel" role="dialog" aria-modal="true" aria-labelledby="cinfo-name">
    <button class="cinfo__close" data-cinfo-close type="button" aria-label="Close class details">✕</button>
    <p class="eyebrow"><span data-cinfo-when></span></p>
    <h2 class="display display--md" id="cinfo-name"></h2>
    <p class="cinfo__note" data-cinfo-note></p>
    <dl class="cinfo__meta">
      <div><dt>Instructor</dt><dd><b data-cinfo-instructor></b><i data-cinfo-role></i></dd></div>
      <div><dt>Duration</dt><dd data-cinfo-dur></dd></div>
      <div><dt>Level</dt><dd data-cinfo-level></dd></div>
      <div><dt>Availability</dt><dd data-cinfo-spots></dd></div>
    </dl>
    <button class="btn btn--block js-book" data-cinfo-close data-cinfo-book type="button">Book this class</button>
  </div>
</div>
'''

import re, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
p = 'index.html'; s = open(p).read()
START = '<!-- ───────────────────────────── 6. SCHEDULE ───────────────────────────── -->'
END   = '<!-- ───────────────────────────── 6. MEMBERSHIPS ───────────────────────────── -->'
assert END in s, 'memberships anchor missing'
if START in s:
    # replace the section that is already there
    s = s[:s.index(START)] + SECTION.strip() + '\n\n' + s[s.index(END):]
else:
    s = s.replace(END, SECTION.strip() + '\n\n' + END, 1)
    banchor = '<!-- ───────────────────────────── BOOKING ───────────────────────────── -->'
    assert banchor in s
    s = s.replace(banchor, OVERLAY.strip() + '\n\n' + banchor, 1)
open(p, 'w').write(s)
print('schedule written:', sum(len(r[2]) for r in WEEK), 'classes')
