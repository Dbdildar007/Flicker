# Flicks — React Native CLI App

## 🎬 Folder Structure
```
FlicksApp/
├── App.js                          ← Root: splash logic + AppState detection
├── index.js
├── app.json / babel.config.js / metro.config.js / package.json
└── src/
    ├── context/
    │   └── AppContext.js            ← Session, myList, toast
    ├── data/
    │   └── theme.js                ← COLORS, FONTS, SPACING, RADIUS, SHADOW
    ├── lib/
    │   └── supabase.js             ← moviesAPI, episodesAPI, ratingsAPI, authAPI
    ├── navigation/
    │   └── AppNavigator.js         ← Tab nav (custom 3D glass bar) + FAB + stack screens
    ├── components/
    │   ├── FlicksHeader.js         ← Glass header: F in red, scroll-reactive opacity
    │   ├── HeroCarousel.js         ← Auto-running hero with zoom+fade transitions
    │   ├── MovieCard.js            ← 3D glass interactive card, no white space on image
    │   ├── MovieRow.js             ← Horizontal scrolling row with auto-drift
    │   ├── CategoryGrid.js         ← Horizontal category chips (glass 3D)
    │   └── UIComponents.js         ← GlassCard, SkeletonBox, RatingStars, NoInternet, Toast
    └── screens/
        ├── SplashScreen.js         ← FLICKS letters run from left, F in red, rocket out right
        ├── HomeScreen.js           ← Full home: hero, continue watching, rows, categories
        └── AllScreens.js           ← SearchScreen, MovieDetailScreen, GenreScreen,
                                       MoviesScreen, FriendsScreen, ProfileScreen
```

---

## ⚡ Quick Setup

### 1. Create project
```bash
npx react-native@0.73.6 init FlicksApp
cd FlicksApp
```

### 2. Install dependencies
```bash
npm install \
  @react-native-async-storage/async-storage \
  @react-native-community/netinfo \
  @react-navigation/bottom-tabs \
  @react-navigation/native \
  @react-navigation/native-stack \
  @supabase/supabase-js \
  react-native-blur \
  react-native-gesture-handler \
  react-native-linear-gradient \
  react-native-reanimated \
  react-native-safe-area-context \
  react-native-screens \
  react-native-url-polyfill \
  react-native-vector-icons \
  react-native-video \
  react-native-fast-image
```

### 3. Copy all source files from this archive

### 4. Configure Supabase
Open `src/lib/supabase.js` and replace:
```js
const SUPABASE_URL  = 'https://your-project.supabase.co';
const SUPABASE_ANON = 'your-anon-key';
```

### 5. Android setup
**android/app/src/main/AndroidManifest.xml** — add:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**android/app/build.gradle**:
```groovy
android { compileSdkVersion 34 }
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

### 6. Run
```bash
npx react-native run-android
```

---

## ✨ Feature Summary

| Feature | Detail |
|---|---|
| **Splash** | F-L-I-C-K-S letters slide in from left, jump, rocket right. F in neon red. AppState aware — skips on background resume |
| **Hero Carousel** | Auto-transitions every 4.5s. Zoom+fade image, slide-in text. Animated dot progress bar |
| **Glass Header** | 50% transparent on load → 20% transparent on scroll. FLICKS logo with red F. 3D glass style |
| **Tab Bar** | Rounded 3D glass pills. Glow + scale animation on active tab. 20% transparent background |
| **Movie Cards** | Full bleed images (no white space). 3D glass border glow on press. VipBadge / Series tag |
| **Continue Watching** | Progress bar per item, series episode info, play button overlay |
| **Category Grid** | Horizontally scrolling glass 3D cards with per-genre gradient and icon |
| **No Internet** | Full-screen with retry + Open Settings buttons |
| **Skeleton** | 1-second animated skeleton before data loads |
| **Floating Button** | Rotating ring with pulse animation |
| **Ratings** | Star rating component; reads/writes to `movie_ratings` table |
| **Search** | Debounced live search against Supabase `movies` table |
| **Transitions** | `fade_from_bottom` (tab switch) + `slide_from_right` (push) + `fade` (search) |

---

## 🗄 Supabase SQL Setup

These functions help ratings work:
```sql
-- Already covered by the movie_ratings table you provided.
-- Make sure RLS policies allow reads & writes for authenticated users.

ALTER TABLE movie_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can rate" ON movie_ratings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read avg" ON movie_ratings FOR SELECT USING (true);
```
