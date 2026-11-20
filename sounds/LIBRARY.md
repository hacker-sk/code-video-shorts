# Sound library: tags and moods

Generated automatically from the files (do not edit). 936 sound effects, 100 music tracks.

## How reels use it

- **No `audio.json`** (or one with `"auto": true`): the script text is read and sound is planned for it: a different music track for each mood of the story (crossfaded), and effects on story turns, numbers, shocks, questions, danger, fire/water... See `plan.mjs`. The plan is printed in the render log as `[auto]` lines.
- **Several tracks by hand:** `"bgm":[{"mood":"calm","from":0,"to":30},{"mood":"epic","fromLine":12}]` or `{"sound":"bgm/<track>"}` per section.
- **One effect by hand:** `{"line":12,"sound":"sfx/.../Deep hit"}`; a tag also works as a keyword, e.g. `"sound":"riser"`.
- **Fix a wrong label** or hide a sound: add it to `sounds/overrides.json`, e.g. `{"bgm/some-track":{"moods":["epic"]},"sfx/some/loud-one":{"skip":true}}`, then run the Sound Catalog workflow.
- Weapon sounds are never picked automatically.

## Sound effect tags

A sound can have several tags. Lists: `tags/<tag>.txt` (path and length).

| Tag | Sounds | List | Examples |
|---|---|---|---|
| whoosh | 300 | tags/whoosh.txt | whoosh, Deep whoosh hit, Whoosh hit |
| transition | 157 | tags/transition.txt | Dramatic Horn Transition 01, Dramatic Horn Transition 02, Dramatic Horn Transition 03 |
| misc | 153 | tags/misc.txt | 000000000000000000 ooo maga, 1-108, 10 famous sound effects 1 |
| meme | 93 | tags/meme.txt | Anime_WOW_-_Sound_Effect_HD_(getmp3.pro), Awkward Moment, Bruh - Sound Effect (HD) (320 kbps) |
| weapon | 64 | tags/weapon.txt | nuke-bomb, HK21, RPK |
| glitch | 63 | tags/glitch.txt | CINEMATIC GLITCH (1), CINEMATIC GLITCH (29), CINEMATIC GLITCH (37) |
| ui | 55 | tags/ui.txt | Discord notification, minecraft_click, samsung-spaceline-notification |
| hit | 51 | tags/hit.txt | Punch - Gaming Sound Effect (HD) (320 kbps), Continue hit, Deep hit |
| riser | 47 | tags/riser.txt | 360-riser-impact-370401, LONG RISER (33), QUICK RISER (7) |
| subdrop | 25 | tags/subdrop.txt | BASS DROP (10), BASS DROP (16), Cinematic Sub Drop - 01 |
| camera | 23 | tags/camera.txt | Camera Shutter, 8mm-film-camera-6446, shutter-39318 |
| water | 21 | tags/water.txt | brain-aneurysm, water-droplet-drip, TRAIN 1 |
| bell | 20 | tags/bell.txt | y2mate.com - Taco Bell  Sound Effect Free No Copyright Sounds, Flare two, Flare |
| tension | 19 | tags/tension.txt | CLOCK TENSION (7), DEEP DRONE (32), ETHERAL DRONE (43) |
| slowmo | 16 | tags/slowmo.txt | Into slowmo, Fly by multiple, Inspire |
| vehicle | 13 | tags/vehicle.txt | helicopter-meme, SUBWAY 1, SUBWAY 2 |
| fire | 11 | tags/fire.txt | basicbeam_fire, FIRE 1, FIRE 2 |
| wind | 8 | tags/wind.txt | Thunder, WIND AMBIENT (4), The wind |
| money | 6 | tags/money.txt | Mario Coin Sound - Sound Effect (HD), Cash Register 1, Cash Register 3 |
| clock | 4 | tags/clock.txt | CLOCK TENSION (7), Cuckoo Clock (3 times), u_mx4xkr2bzy-slow-cinematic-clock-ticking-tension-323080 |
| scifi | 4 | tags/scifi.txt | Phil Michalski - Sci Fi Ambiance Motion in Space Distant High Bleep, Future swoosh, Future zing |
| crowd | 3 | tags/crowd.txt | Kids Cheering - Gaming Sound Effect (HD) (320 kbps), clap-10-36723, clap-10-36723 |
| laugh | 3 | tags/laugh.txt | laughter-short, one-piece-brooks-laugh-15-minutes, flipagram roasting - laugh meme |
| alarm | 2 | tags/alarm.txt | Warning Siren meme, Metal Gear Alert Sound Effect |
| nature | 1 | tags/nature.txt | Birds take off |

## Music moods

Moods are measured from the audio (loudness, brightness, tempo, dynamics, compared with the other tracks) and from words in the file name, so they are a good first guess, not a promise. Correct any in `overrides.json`.

| Mood | Tracks | List |
|---|---|---|
| hopeful | 30 | tags/bgm-hopeful.txt |
| tense | 20 | tags/bgm-tense.txt |
| warm | 19 | tags/bgm-warm.txt |
| mysterious | 14 | tags/bgm-mysterious.txt |
| epic | 13 | tags/bgm-epic.txt |
| dark | 13 | tags/bgm-dark.txt |
| playful | 12 | tags/bgm-playful.txt |
| calm | 12 | tags/bgm-calm.txt |
| energetic | 9 | tags/bgm-energetic.txt |
| sad | 5 | tags/bgm-sad.txt |

## All music tracks

Energy and brightness are ranks among all tracks (0 = lowest, 100 = highest). BPM is approximate.

| Track | Length | BPM | Energy | Brightness | Moods |
|---|---|---|---|---|---|
| BlankEye | 2:04 | 74 | 7 | 91 | calm, hopeful |
| CHILDSONG | 2:09 | 83 | 1 | 35 | calm, sad |
| LaRecompensa | 2:01 | 81 | 17 | 67 | calm, warm |
| LoudNoises | 1:31 | 74 | 16 | 86 | calm, warm |
| Ona | 1:01 | 81 | 13 | 66 | calm, warm |
| PiecesOfTheRainbow | 1:52 | 136 | 99 | 24 | calm, tense |
| RestInPeace | 1:08 | 112 | 12 | 10 | calm, mysterious |
| Tajs | 1:02 | 86 | 4 | 63 | calm |
| WorldSong | 1:27 | 74 | 6 | 16 | calm, sad |
| dessekk | 2:18 | 136 | 3 | 13 | calm, warm |
| 64.NonePublicStop | 1:53 | 96 | 90 | 9 | dark |
| Destroy | 2:45 | 81 | 94 | 31 | dark, warm |
| Lust | 2:07 | 76 | 56 | 5 | dark, sad |
| MatrixTypeTestSylenth1 | 0:57 | 117 | 72 | 29 | dark, tense |
| Nitro | 1:22 | 103 | 44 | 21 | dark, mysterious |
| Senegal | 2:56 | 89 | 79 | 19 | dark |
| Shark | 1:55 | 89 | 88 | 7 | dark |
| Tahj | 1:31 | 129 | 24 | 11 | dark, calm |
| 77.MantramDog | 1:40 | 140 | 78 | 53 | energetic |
| Otto | 1:53 | 140 | 58 | 71 | energetic, playful |
| WaveBackTheEvening | 1:37 | 140 | 92 | 55 | energetic |
| YEAH | 1:48 | 108 | 91 | 64 | energetic, playful |
| thumb | 1:57 | 136 | 84 | 45 | energetic |
| 06-Dhalius-06-tremble | 1:53 | 117 | 60 | 51 | epic |
| 71.SoundSister | 1:50 | 140 | 95 | 47 | epic |
| 74.TenSummers | 2:31 | 120 | 76 | 43 | epic |
| 80.80MinutesAdd | 2:38 | 92 | 65 | 54 | epic |
| BlackHawk | 1:19 | 86 | 81 | 41 | epic |
| Eliminate_your_senses | 0:59 | 140 | 98 | 40 | epic |
| FormulaFantasy | 1:38 | 136 | 87 | 69 | epic, energetic |
| HighImpact | 2:12 | 92 | 75 | 22 | epic |
| JazzyTune | 1:18 | 92 | 85 | 36 | epic |
| StellarAndromeda | 1:17 | 99 | 96 | 18 | epic |
| Ways | 3:00 | 140 | 80 | 26 | epic, tense |
| 68.SearchForTheTrumpetman | 1:22 | 108 | 41 | 95 | hopeful |
| 7.AfectedTvShow | 1:42 | 108 | 22 | 81 | hopeful |
| 73.TaintedHearts | 1:24 | 81 | 82 | 75 | hopeful, warm |
| AloneInTheUnlimitedMountains | 1:36 | 120 | 31 | 77 | hopeful |
| ChasingDreams | 1:04 | 129 | 11 | 82 | hopeful |
| EccoPlasma | 0:38 | 136 | 34 | 65 | hopeful |
| EverythingIsGonnaBeOk | 1:37 | 112 | 19 | 96 | hopeful |
| JoesMachine | 2:15 | 129 | 67 | 48 | hopeful, tense |
| Klone | 1:42 | 117 | 32 | 87 | hopeful |
| OneStrangeMomentInLife | 2:08 | 120 | 59 | 62 | hopeful |
| Oxygen | 1:09 | 129 | 2 | 85 | hopeful, warm |
| PandaKiller | 2:31 | 81 | 70 | 100 | hopeful, warm |
| RomeDia | 1:33 | 117 | 33 | 89 | hopeful |
| SAPHIRE | 1:04 | 120 | 26 | 79 | hopeful |
| SunLifeMoonFriend | 2:12 | 81 | 86 | 3 | hopeful, dark |
| Ta | 1:20 | 133 | 9 | 56 | hopeful, mysterious |
| TheShoesOfMama | 1:44 | 120 | 40 | 98 | hopeful |
| UFO | 1:21 | 120 | 39 | 84 | hopeful, epic |
| Vakkk | 2:27 | 133 | 5 | 92 | hopeful, playful |
| dreams | 1:57 | 89 | 43 | 78 | hopeful |
| dust | 1:07 | 86 | 93 | 70 | hopeful, warm |
| Against | 2:18 | 76 | 21 | 25 | mysterious, sad |
| AutoMeditate | 2:20 | 81 | 18 | 72 | mysterious |
| DancingInTheRainDancingBeetwenTheStairs | 2:03 | 99 | 36 | 76 | mysterious, hopeful |
| FreeLife | 1:13 | 92 | 10 | 44 | mysterious |
| LANDING | 0:58 | 133 | 8 | 73 | mysterious, hopeful |
| QCROM | 1:22 | 140 | 23 | 27 | mysterious, tense |
| RuinsOfMyHeart | 1:08 | 129 | 35 | 20 | mysterious |
| TerceraGuerraMundial | 1:36 | 86 | 45 | 46 | mysterious |
| bright | 1:20 | 81 | 55 | 57 | mysterious |
| ghost | 3:18 | 81 | 29 | 39 | mysterious |
| AstralTravelingToBudapest | 0:56 | 140 | 15 | 68 | playful, hopeful |
| Dome | 2:51 | 140 | 62 | 88 | playful |
| Overkill | 1:58 | 140 | 57 | 94 | playful |
| QWERTY | 1:59 | 140 | 37 | 93 | playful |
| ShortPieces | 1:10 | 140 | 61 | 99 | playful |
| ShortTerm | 1:22 | 140 | 30 | 58 | playful, hopeful |
| TemaSinNombreedit | 2:34 | 136 | 46 | 80 | playful, hopeful |
| TheTrip | 1:42 | 123 | 66 | 83 | playful |
| janeiro | 2:25 | 144 | 47 | 74 | playful |
| 65.Paterson | 1:34 | 136 | 0 | 1 | sad, dark |
| 6.DigitalLiveRetro | 1:40 | 140 | 38 | 28 | tense |
| 72.SucesiveMountains | 1:11 | 136 | 64 | 17 | tense |
| Da | 1:59 | 136 | 14 | 8 | tense, mysterious |
| DependingOnWhatSideYouAre | 1:04 | 140 | 74 | 32 | tense, energetic |
| EmergencySystem | 1:53 | 140 | 97 | 2 | tense |
| HelloUnderdog | 1:38 | 129 | 83 | 14 | tense |
| JENNY | 0:60 | 129 | 77 | 6 | tense, dark |
| Jinglepunks005127bpm | 1:04 | 129 | 53 | 42 | tense |
| Joust | 1:17 | 140 | 89 | 4 | tense, epic |
| KeepThisMusicForTwelveEndingMoments | 1:10 | 152 | 20 | 12 | tense |
| Lotus | 1:23 | 126 | 100 | 0 | tense, dark |
| Pittsburgh | 2:00 | 129 | 73 | 37 | tense, energetic |
| Sloth | 1:11 | 144 | 48 | 34 | tense, energetic |
| WindOfFortune | 2:16 | 123 | 69 | 23 | tense |
| palermo | 2:03 | 123 | 49 | 33 | tense |
| CharlieSheenDrug | 1:26 | 76 | 52 | 59 | warm |
| DeathSilenceOvertureEnd | 2:29 | 76 | 54 | 90 | warm, hopeful |
| Eak | 2:09 | 133 | 27 | 15 | warm, calm |
| GoodbyeUnderdog | 1:31 | 92 | 63 | 52 | warm, hopeful |
| Greed | 2:08 | 78 | 71 | 49 | warm |
| Pinnacle | 1:26 | 81 | 25 | 97 | warm, hopeful |
| SmileDrone | 1:40 | 92 | 51 | 60 | warm |
| StandingSupervisor | 0:48 | 92 | 42 | 38 | warm |
| TheLastTimeISawYou | 2:08 | 92 | 28 | 61 | warm |
| Unbeaten | 1:51 | 89 | 68 | 30 | warm, dark |
