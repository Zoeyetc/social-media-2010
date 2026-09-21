# Canonical Weather correction v0.1

Classification: **HISTORICALLY GROUNDED RECONSTRUCTION**.

The canonical session begins 2010-10-20 00:02 America/Los_Angeles. Its fixed
Weather display is Los Angeles, **62°F / Light Rain**. No host time, current
weather, geolocation, or live service determines this value. Reset restores it.

[Los Angeles daily historical records, sourced from NOAA](https://www.extremeweatherwatch.com/cities/los-angeles/year-2010)
report October 20, 2010 at 66°F high, 61°F low and 0.10 inches precipitation.
This supports a cool/wet day rather than the previous 73°F Sunny display.
Daily extrema and precipitation do not establish conditions at 00:02. The exact
62°F / Light Rain display is a conservative experience reconstruction, not a
verified minute-by-minute station observation.

SpringBoard and multitasking use the same canonical temperature as the app.
The archival Weather icon is a flattened raster with static sun artwork;
its asset is preserved, with only a reconstructed temperature overlay. The
condition artwork is not independently editable through this icon system.
The Weather app uses a reconstructed static cloud/rain symbol. No icon layout,
app lifecycle, session clock, or scheduler behavior changes.

## Nighttime board v0.4

- **EVIDENCE-BACKED:** Apple's *iPhone User Guide, iOS 4*, Weather chapter,
  p.150 ([archived Apple-authored PDF](https://macdailynews.com/wp-content/uploads/2010/06/iphone_ios4_user_guide.pdf)), describes light-blue daytime boards (06:00–17:59), dark-purple nighttime boards (18:00–05:59), high/low, six-day forecasts, and city dots. This is behavioral evidence, not an exact gradient specification.
- **DERIVED FROM CANONICAL CLOCK + EVIDENCE-BACKED RULE:** the app receives
  `simulatedDeviceDateTime(elapsed)` through DeviceScreen. Explicit
  `America/Los_Angeles` formatting selects night throughout 00:02–00:17.
  Host local time and `Date.now()` are not Weather inputs.
- **HISTORICALLY GROUNDED RECONSTRUCTION:** 62°F / Light Rain and the already
  documented 66°F high / 61°F low remain fixed for the canonical day.
- **RECONSTRUCTED / BEST FIT:** exact dark navy-to-purple gradient, restrained
  gloss/separators, shaded cloud/rain artwork and micro-spacing.
- **Forecast content:** no approved historical six-day prediction dataset exists.
  Six static rows run Wednesday–Monday. Wednesday reuses the documented day
  range; subsequent high/low and conditions show unavailable em dashes. These
  are explicitly reconstructed placeholders, not fabricated forecasts or
  later observed weather presented as forecasts. No service is queried.
- **Info control HOLD:** city management is unsupported; no inert or invented
  settings interaction is added. One active city dot is retained.

SpringBoard icon typography and layout are unchanged by v0.4.

## Six-day historical board v0.5 (supersedes unavailable rows in v0.4)

**HISTORICALLY GROUNDED RECONSTRUCTION.** Historical daily observed high/low
values are used to reconstruct the six-day Weather board. This is not claimed
to be the exact forecast shown by Yahoo Weather on the device at 00:02 on
October 20, 2010. Values below are the locked daily observations supplied for
this content pass; temperatures are Fahrenheit and precipitation is inches.

| Date | Observed high | Observed low | Observed precipitation | Board condition classification | Evidence level |
|---|---:|---:|---:|---|---|
| 2010-10-20 | 66° | 61° | 0.10 | Light Rain — RECONSTRUCTED | HISTORICAL DAILY OBSERVATION |
| 2010-10-21 | 66° | 62° | 0.00 | Cloudy — RECONSTRUCTED | HISTORICAL DAILY OBSERVATION |
| 2010-10-22 | 67° | 61° | 0.00 | Cloudy — RECONSTRUCTED | HISTORICAL DAILY OBSERVATION |
| 2010-10-23 | 68° | 60° | 0.01 | Chance of Rain — RECONSTRUCTED | HISTORICAL DAILY OBSERVATION |
| 2010-10-24 | 68° | 58° | 0.10 | Light Rain — RECONSTRUCTED | HISTORICAL DAILY OBSERVATION |
| 2010-10-25 | 75° | 62° | 0.08 | Showers — RECONSTRUCTED | HISTORICAL DAILY OBSERVATION |

The existing reconstructed shaded cloud/rain graphic is reused. Thursday and
Friday use its cloud without drops; this is a conservative existing-art variant,
not a verified cloud-cover report. No approved separate partly-cloudy asset was
found. All condition labels and icons are RECONSTRUCTED: precipitation alone
cannot establish the exact condition or Yahoo icon. Current 62°F / Light Rain,
night/day rules, and the current-day 66°/61° range remain unchanged. The immutable
six-row dataset is deterministic across app switching and session resets.
