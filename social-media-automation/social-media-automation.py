#!/usr/bin/env python3
"""
Social Media Automation Suite
Unified script for posting to TikTok and Instagram with voice command support
"""

import os
import sys
import json
import argparse
import subprocess
from typing import Dict, Any, Optional
from datetime import datetime

# Import our platform-specific posters
from instagram_poster import InstagramPoster
from tiktok_poster import TikTokPoster

class SocialMediaAutomation:
    def __init__(self):
        """Initialize the social media automation suite"""
        self.load_credentials()
        
    def load_credentials(self):
        """Load API credentials from environment variables"""
        # Instagram credentials
        self.instagram_app_id = os.getenv("INSTAGRAM_APP_ID", "1539700640416618")
        self.instagram_app_secret = os.getenv("INSTAGRAM_APP_SECRET", "592580e08fb2ad5d0979fac07979db60")
        self.instagram_access_token = os.getenv("INSTAGRAM_ACCESS_TOKEN")
        self.instagram_user_id = os.getenv("INSTAGRAM_USER_ID")
        
        # TikTok credentials
        self.tiktok_access_token = os.getenv("TIKTOK_ACCESS_TOKEN")
        
        # Validate credentials
        self.validate_credentials()
    
    def validate_credentials(self):
        """Validate that required credentials are available"""
        missing = []
        
        if not self.instagram_access_token:
            missing.append("INSTAGRAM_ACCESS_TOKEN")
        if not self.instagram_user_id:
            missing.append("INSTAGRAM_USER_ID")
        if not self.tiktok_access_token:
            missing.append("TIKTOK_ACCESS_TOKEN")
        
        if missing:
            print("⚠️  Warning: Missing credentials for:")
            for cred in missing:
                print(f"   - {cred}")
            print("\nSet these environment variables to use all features.")
    
    def post_to_instagram(self, content_type: str, **kwargs) -> Dict[str, Any]:
        """
        Post content to Instagram
        
        Args:
            content_type: 'image', 'carousel', or 'video'
            **kwargs: Platform-specific parameters
            
        Returns:
            API response
        """
        if not self.instagram_access_token or not self.instagram_user_id:
            return {"error": "Instagram credentials not configured"}
        
        print("📷 Posting to Instagram...")
        
        poster = InstagramPoster(
            self.instagram_app_id,
            self.instagram_app_secret,
            self.instagram_access_token
        )
        
        try:
            if content_type == "image":
                return poster.post_single_image(
                    image_url=kwargs["image_url"],
                    caption=kwargs["caption"],
                    ig_user_id=self.instagram_user_id,
                    alt_text=kwargs.get("alt_text")
                )
            elif content_type == "carousel":
                return poster.post_carousel(
                    image_urls=kwargs["image_urls"],
                    caption=kwargs["caption"],
                    ig_user_id=self.instagram_user_id
                )
            else:
                return {"error": f"Unsupported content type: {content_type}"}
        except Exception as e:
            return {"error": f"Instagram posting failed: {str(e)}"}
    
    def post_to_tiktok(self, content_type: str, **kwargs) -> Dict[str, Any]:
        """
        Post content to TikTok
        
        Args:
            content_type: 'video' or 'photos'
            **kwargs: Platform-specific parameters
            
        Returns:
            API response
        """
        if not self.tiktok_access_token:
            return {"error": "TikTok credentials not configured"}
        
        print("🎵 Posting to TikTok...")
        
        poster = TikTokPoster(self.tiktok_access_token)
        
        try:
            if content_type == "video":
                if kwargs.get("video_path") and os.path.exists(kwargs["video_path"]):
                    return poster.upload_video_from_file(
                        video_path=kwargs["video_path"],
                        caption=kwargs["caption"],
                        privacy_level=kwargs.get("privacy_level", "PUBLIC")
                    )
                else:
                    return poster.upload_video_from_url(
                        video_url=kwargs["video_url"],
                        caption=kwargs["caption"],
                        privacy_level=kwargs.get("privacy_level", "PUBLIC")
                    )
            elif content_type == "photos":
                return poster.upload_photos(
                    photo_urls=kwargs["photo_urls"],
                    title=kwargs["title"],
                    description=kwargs["description"],
                    privacy_level=kwargs.get("privacy_level", "PUBLIC")
                )
            else:
                return {"error": f"Unsupported content type: {content_type}"}
        except Exception as e:
            return {"error": f"TikTok posting failed: {str(e)}"}
    
    def post_to_both(self, content_type: str, **kwargs) -> Dict[str, Any]:
        """
        Post the same content to both platforms
        
        Args:
            content_type: Type of content
            **kwargs: Platform-specific parameters
            
        Returns:
            Combined results from both platforms
        """
        print("🚀 Posting to both Instagram and TikTok...")
        
        results = {}
        
        # Post to Instagram
        if content_type in ["image", "carousel"]:
            results["instagram"] = self.post_to_instagram(content_type, **kwargs)
        
        # Post to TikTok
        if content_type in ["video", "photos"]:
            results["tiktok"] = self.post_to_tiktok(content_type, **kwargs)
        
        return results
    
    def voice_command_interface(self):
        """
        Voice command interface for social media automation
        """
        print("🎤 Voice Command Interface")
        print("Say commands like:")
        print("  'Post image to Instagram with caption sunset vibes'")
        print("  'Upload video to TikTok with caption check this out'")
        print("  'Post carousel to Instagram'")
        print("  'Post to both platforms'")
        print("\nPress Ctrl+C to exit")
        
        try:
            while True:
                # Use speech recognition (you'll need to install speech recognition library)
                command = self.get_voice_command()
                if command:
                    self.process_voice_command(command)
        except KeyboardInterrupt:
            print("\n👋 Voice command interface stopped")
    
    def get_voice_command(self) -> Optional[str]:
        """
        Get voice command from user
        (Implementation depends on your preferred speech recognition library)
        """
        # For now, use text input as placeholder
        # In a real implementation, you'd use speech_recognition or similar
        try:
            command = input("\n🎤 Enter command (or 'quit' to exit): ").strip()
            if command.lower() in ['quit', 'exit', 'stop']:
                return None
            return command
        except EOFError:
            return None
    
    def process_voice_command(self, command: str):
        """
        Process voice command and execute appropriate action
        
        Args:
            command: Voice command text
        """
        command_lower = command.lower()
        
        # Parse platform
        platform = None
        if "instagram" in command_lower:
            platform = "instagram"
        elif "tiktok" in command_lower:
            platform = "tiktok"
        elif "both" in command_lower or "all" in command_lower:
            platform = "both"
        
        # Parse content type
        content_type = None
        if "image" in command_lower or "photo" in command_lower:
            content_type = "image" if platform != "tiktok" else "photos"
        elif "video" in command_lower:
            content_type = "video"
        elif "carousel" in command_lower:
            content_type = "carousel"
        
        # Extract caption (basic implementation)
        caption = ""
        if "with caption" in command_lower:
            parts = command_lower.split("with caption")
            if len(parts) > 1:
                caption = parts[1].strip().strip('"\'')
        
        # Execute command
        if platform and content_type:
            print(f"\n🎯 Executing: {content_type} to {platform}")
            
            if platform == "both":
                # For demo purposes, use placeholder URLs
                if content_type == "image":
                    result = self.post_to_both(
                        content_type="image",
                        image_url="https://example.com/demo.jpg",
                        caption=caption or "Amazing content! 🌟"
                    )
                else:
                    result = {"error": "Voice command for this content type not implemented"}
            else:
                if platform == "instagram":
                    result = self.post_to_instagram(
                        content_type=content_type,
                        image_url="https://example.com/demo.jpg",
                        caption=caption or "Amazing content! 🌟"
                    )
                else:  # TikTok
                    result = self.post_to_tiktok(
                        content_type=content_type,
                        video_url="https://example.com/demo.mp4",
                        caption=caption or "Amazing content! 🌟"
                    )
            
            print(f"✅ Result: {json.dumps(result, indent=2)}")
        else:
            print("❌ Could not understand command. Please try again.")
    
    def interactive_mode(self):
        """Interactive command-line interface"""
        print("🤖 Social Media Automation Suite")
        print("=" * 50)
        
        while True:
            print("\nChoose an option:")
            print("1. Post to Instagram")
            print("2. Post to TikTok")
            print("3. Post to both platforms")
            print("4. Voice commands")
            print("5. Exit")
            
            choice = input("\nEnter choice (1-5): ").strip()
            
            if choice == "1":
                self.instagram_interactive()
            elif choice == "2":
                self.tiktok_interactive()
            elif choice == "3":
                self.both_platforms_interactive()
            elif choice == "4":
                self.voice_command_interface()
            elif choice == "5":
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid choice. Please try again.")
    
    def instagram_interactive(self):
        """Interactive Instagram posting"""
        print("\n📷 Instagram Posting")
        
        content_type = input("Content type (image/carousel): ").strip().lower()
        caption = input("Caption: ").strip()
        
        if content_type == "image":
            image_url = input("Image URL: ").strip()
            alt_text = input("Alt text (optional): ").strip()
            
            result = self.post_to_instagram(
                content_type="image",
                image_url=image_url,
                caption=caption,
                alt_text=alt_text if alt_text else None
            )
        elif content_type == "carousel":
            urls_input = input("Image URLs (comma-separated): ").strip()
            image_urls = [url.strip() for url in urls_input.split(",")]
            
            result = self.post_to_instagram(
                content_type="carousel",
                image_urls=image_urls,
                caption=caption
            )
        else:
            result = {"error": "Invalid content type"}
        
        print(f"Result: {json.dumps(result, indent=2)}")
    
    def tiktok_interactive(self):
        """Interactive TikTok posting"""
        print("\n🎵 TikTok Posting")
        
        content_type = input("Content type (video/photos): ").strip().lower()
        caption = input("Caption: ").strip()
        
        if content_type == "video":
            source_type = input("Source type (file/url): ").strip().lower()
            
            if source_type == "file":
                video_path = input("Video file path: ").strip()
                result = self.post_to_tiktok(
                    content_type="video",
                    video_path=video_path,
                    caption=caption
                )
            else:
                video_url = input("Video URL: ").strip()
                result = self.post_to_tiktok(
                    content_type="video",
                    video_url=video_url,
                    caption=caption
                )
        elif content_type == "photos":
            urls_input = input("Photo URLs (comma-separated): ").strip()
            photo_urls = [url.strip() for url in urls_input.split(",")]
            title = input("Title: ").strip()
            
            result = self.post_to_tiktok(
                content_type="photos",
                photo_urls=photo_urls,
                title=title,
                description=caption
            )
        else:
            result = {"error": "Invalid content type"}
        
        print(f"Result: {json.dumps(result, indent=2)}")
    
    def both_platforms_interactive(self):
        """Interactive posting to both platforms"""
        print("\n🚀 Post to Both Platforms")
        
        content_type = input("Content type (image/video): ").strip().lower()
        caption = input("Caption: ").strip()
        
        if content_type == "image":
            image_url = input("Image URL: ").strip()
            result = self.post_to_both(
                content_type="image",
                image_url=image_url,
                caption=caption
            )
        elif content_type == "video":
            video_url = input("Video URL: ").strip()
            result = self.post_to_both(
                content_type="video",
                video_url=video_url,
                caption=caption
            )
        else:
            result = {"error": "Invalid content type"}
        
        print(f"Result: {json.dumps(result, indent=2)}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Social Media Automation Suite")
    parser.add_argument("--mode", choices=["interactive", "voice"], default="interactive",
                       help="Interface mode")
    parser.add_argument("--platform", choices=["instagram", "tiktok", "both"],
                       help="Target platform")
    parser.add_argument("--content-type", choices=["image", "video", "carousel", "photos"],
                       help="Content type")
    parser.add_argument("--caption", help="Caption for the post")
    parser.add_argument("--image-url", help="Image URL")
    parser.add_argument("--video-url", help="Video URL")
    parser.add_argument("--video-path", help="Local video file path")
    
    args = parser.parse_args()
    
    # Initialize automation suite
    automation = SocialMediaAutomation()
    
    if args.mode == "voice":
        automation.voice_command_interface()
    else:
        # Check if command line arguments provided
        if args.platform and args.content_type:
            # Command line mode
            if args.platform == "instagram":
                result = automation.post_to_instagram(
                    content_type=args.content_type,
                    image_url=args.image_url,
                    caption=args.caption or "Automated post 🤖"
                )
            elif args.platform == "tiktok":
                if args.video_path:
                    result = automation.post_to_tiktok(
                        content_type=args.content_type,
                        video_path=args.video_path,
                        caption=args.caption or "Automated post 🤖"
                    )
                else:
                    result = automation.post_to_tiktok(
                        content_type=args.content_type,
                        video_url=args.video_url,
                        caption=args.caption or "Automated post 🤖"
                    )
            else:  # both
                result = automation.post_to_both(
                    content_type=args.content_type,
                    image_url=args.image_url,
                    video_url=args.video_url,
                    caption=args.caption or "Automated post 🤖"
                )
            
            print(f"Result: {json.dumps(result, indent=2)}")
        else:
            # Interactive mode
            automation.interactive_mode()


if __name__ == "__main__":
    main()
