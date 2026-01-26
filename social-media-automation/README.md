# Social Media Automation Suite

Automate posting to TikTok and Instagram from your terminal using voice commands or CLI.

## 🚀 Quick Start

### 1. Setup
```bash
cd social-media-automation
python3 setup.py
```

### 2. Configure API Credentials
Edit `.env` file with your credentials:

```bash
# Instagram API Credentials (already configured)
INSTAGRAM_APP_ID=1539700640416618
INSTAGRAM_APP_SECRET=592580e08fb2ad5d0979fac07979db60
INSTAGRAM_ACCESS_TOKEN=your_instagram_user_access_token_here
INSTAGRAM_USER_ID=your_instagram_user_id_here

# TikTok API Credentials (you need to get this)
TIKTOK_ACCESS_TOKEN=your_tiktok_access_token_here
```

### 3. Run the Automation
```bash
# Interactive mode
./run-automation.sh

# Voice command mode
python3 social-media-automation.py --mode voice

# Command line mode
python3 social-media-automation.py --platform instagram --content-type image --image-url "https://example.com/img.jpg" --caption "Amazing sunset!"
```

## 📱 Platform Setup

### Instagram ✅ (Already Configured)
- **App ID**: `1539700640416618`
- **App Secret**: `592580e08fb2ad5d0979fac07979db60`
- **Status**: Ready for use
- **Next**: Get User Access Token and User ID

#### Getting Instagram User Access Token:
1. Go to your app dashboard: https://developers.facebook.com/apps/860925053378176/
2. Navigate to "Use cases" → "Instagram API" → "API setup with Instagram login"
3. Click "Add account" and authenticate your Instagram account
4. Copy the generated access token to your `.env` file
5. Get your Instagram User ID from the Graph API Explorer

### TikTok 🔄 (You Need to Complete)
- **Status**: Setup required
- **Next**: Complete TikTok developer application

#### Getting TikTok Access Token:
1. Go to: https://developers.tiktok.com/
2. Create an app and select "Content Posting API"
3. Complete app review and get access token
4. Add token to your `.env` file

## 🎤 Voice Commands

Use natural language to post content:

```
"Post image to Instagram with caption sunset vibes"
"Upload video to TikTok with caption check this out"
"Post carousel to Instagram"
"Post to both platforms"
```

## 💻 Command Line Usage

### Instagram
```bash
# Post single image
python3 social-media-automation.py \
  --platform instagram \
  --content-type image \
  --image-url "https://example.com/photo.jpg" \
  --caption "Beautiful sunset! 🌅"

# Post carousel
python3 social-media-automation.py \
  --platform instagram \
  --content-type carousel \
  --image-urls "url1,url2,url3" \
  --caption "My photo collection"
```

### TikTok
```bash
# Post video from URL
python3 social-media-automation.py \
  --platform tiktok \
  --content-type video \
  --video-url "https://example.com/video.mp4" \
  --caption "Amazing content! 🎬"

# Post video from file
python3 social-media-automation.py \
  --platform tiktok \
  --content-type video \
  --video-path "/path/to/video.mp4" \
  --caption "Check this out!"

# Post photos
python3 social-media-automation.py \
  --platform tiktok \
  --content-type photos \
  --photo-urls "url1,url2" \
  --title "Photo Gallery" \
  --description "My favorite moments"
```

### Both Platforms
```bash
# Post to both Instagram and TikTok
python3 social-media-automation.py \
  --platform both \
  --content-type image \
  --image-url "https://example.com/photo.jpg" \
  --caption "Cross-platform post! 🚀"
```

## 🔧 Advanced Features

### Custom Scripts
Import the classes in your own scripts:

```python
from social_media_automation import SocialMediaAutomation

automation = SocialMediaAutomation()

# Post to Instagram
result = automation.post_to_instagram(
    content_type="image",
    image_url="https://example.com/photo.jpg",
    caption="Automated post! 🤖"
)

# Post to TikTok
result = automation.post_to_tiktok(
    content_type="video",
    video_url="https://example.com/video.mp4",
    caption="Amazing video!"
)
```

### Batch Processing
Create batch posts from a CSV file:

```python
import pandas as pd
from social_media_automation import SocialMediaAutomation

automation = SocialMediaAutomation()
df = pd.read_csv('posts.csv')

for index, row in df.iterrows():
    result = automation.post_to_instagram(
        content_type="image",
        image_url=row['image_url'],
        caption=row['caption']
    )
    print(f"Posted {index + 1}: {result}")
```

## 🛠️ Troubleshooting

### Common Issues

1. **"Instagram credentials not configured"**
   - Set `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID` in `.env`

2. **"TikTok credentials not configured"**
   - Set `TIKTOK_ACCESS_TOKEN` in `.env`

3. **"Permission denied"**
   - Check that your app has the required permissions
   - Ensure your Instagram account is a Business/Creator account

4. **"Invalid media URL"**
   - Ensure media URLs are publicly accessible
   - Use HTTPS URLs

5. **Voice recognition not working**
   - Install: `pip install SpeechRecognition pyaudio`
   - Check microphone permissions

### Debug Mode
Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📚 API Reference

### InstagramPoster
- `post_single_image(image_url, caption, ig_user_id, alt_text=None)`
- `post_carousel(image_urls, caption, ig_user_id)`
- `create_media_object(image_url, caption, ig_user_id, media_type, alt_text=None)`
- `publish_media(creation_id, ig_user_id)`

### TikTokPoster
- `upload_video_from_file(video_path, caption, privacy_level="PUBLIC")`
- `upload_video_from_url(video_url, caption, privacy_level="PUBLIC")`
- `upload_photos(photo_urls, title, description, privacy_level="PUBLIC")`
- `get_publish_status(publish_id)`

## 🔐 Security Notes

- Keep your API credentials secure and never share them
- Use environment variables instead of hardcoding credentials
- Regularly rotate your access tokens
- Only grant necessary permissions to your apps

## 📄 License

This project is for educational and personal use. Please respect the terms of service of each platform.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

**Happy Posting! 🚀**
