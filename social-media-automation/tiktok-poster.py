#!/usr/bin/env python3
"""
TikTok Content Automation Script
Posts videos and photos to TikTok using the TikTok Content Posting API
"""

import requests
import json
import os
import time
from typing import Optional, Dict, Any

class TikTokPoster:
    def __init__(self, access_token: str):
        """
        Initialize TikTok poster with API credentials
        
        Args:
            access_token: TikTok API Access Token
        """
        self.access_token = access_token
        self.base_url = "https://open.tiktokapis.com/v2"
        
    def upload_video_from_file(self, video_path: str, caption: str, 
                              privacy_level: str = "PUBLIC") -> Dict[str, Any]:
        """
        Upload a video from local file to TikTok
        
        Args:
            video_path: Local path to video file
            caption: Caption for the video
            privacy_level: PUBLIC, FRIENDS, or PRIVATE
            
        Returns:
            API response with upload status
        """
        # Step 1: Initialize video upload
        print("Initializing video upload...")
        init_response = self._initialize_video_upload(video_path, "FILE_UPLOAD")
        
        if "data" not in init_response or "publish_id" not in init_response["data"]:
            print(f"Error initializing upload: {init_response}")
            return init_response
        
        publish_id = init_response["data"]["publish_id"]
        upload_url = init_response["data"].get("upload_url")
        
        print(f"Upload initialized. Publish ID: {publish_id}")
        
        # Step 2: Upload video file
        if upload_url:
            print("Uploading video file...")
            upload_response = self._upload_video_file(video_path, upload_url)
            if upload_response.status_code != 200:
                print(f"Error uploading file: {upload_response.text}")
                return {"error": "File upload failed", "details": upload_response.text}
        
        # Step 3: Publish with metadata
        print("Publishing video...")
        publish_response = self._publish_video(publish_id, caption, privacy_level)
        
        return publish_response
    
    def upload_video_from_url(self, video_url: str, caption: str, 
                              privacy_level: str = "PUBLIC") -> Dict[str, Any]:
        """
        Upload a video from URL to TikTok
        
        Args:
            video_url: Public URL of the video
            caption: Caption for the video
            privacy_level: PUBLIC, FRIENDS, or PRIVATE
            
        Returns:
            API response with upload status
        """
        print("Initializing video upload from URL...")
        init_response = self._initialize_video_upload(video_url, "PULL_FROM_URL")
        
        if "data" not in init_response or "publish_id" not in init_response["data"]:
            print(f"Error initializing upload: {init_response}")
            return init_response
        
        publish_id = init_response["data"]["publish_id"]
        print(f"Upload initialized. Publish ID: {publish_id}")
        
        # Step 2: Publish with metadata
        print("Publishing video...")
        publish_response = self._publish_video(publish_id, caption, privacy_level)
        
        return publish_response
    
    def upload_photos(self, photo_urls: list, title: str, description: str, 
                     privacy_level: str = "PUBLIC") -> Dict[str, Any]:
        """
        Upload photos to TikTok
        
        Args:
            photo_urls: List of public URLs of photos
            title: Title for the photo post
            description: Description for the photo post
            privacy_level: PUBLIC, FRIENDS, or PRIVATE
            
        Returns:
            API response with upload status
        """
        print(f"Uploading {len(photo_urls)} photos...")
        
        url = f"{self.base_url}/post/publish/content/init/"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "post_info": {
                "title": title,
                "description": description,
                "privacy_level": privacy_level
            },
            "source_info": {
                "source": "PULL_FROM_URL",
                "photo_cover_index": 1,
                "photo_images": photo_urls
            },
            "post_mode": "MEDIA_UPLOAD",
            "media_type": "PHOTO"
        }
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            if "data" in result and "publish_id" in result["data"]:
                publish_id = result["data"]["publish_id"]
                print(f"Photos uploaded successfully. Publish ID: {publish_id}")
                return result
            else:
                print(f"Error uploading photos: {result}")
                return result
        else:
            print(f"HTTP Error: {response.status_code} - {response.text}")
            return {"error": f"HTTP {response.status_code}", "details": response.text}
    
    def _initialize_video_upload(self, video_source: str, source_type: str) -> Dict[str, Any]:
        """Initialize video upload process"""
        url = f"{self.base_url}/post/publish/inbox/video/init/"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        if source_type == "FILE_UPLOAD":
            # Get video file size
            file_size = os.path.getsize(video_source) if os.path.exists(video_source) else 0
            
            payload = {
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": file_size,
                    "chunk_size": file_size,
                    "total_chunk_count": 1
                }
            }
        else:  # PULL_FROM_URL
            payload = {
                "source_info": {
                    "source": "PULL_FROM_URL",
                    "video_url": video_source
                }
            }
        
        response = requests.post(url, headers=headers, json=payload)
        return response.json()
    
    def _upload_video_file(self, video_path: str, upload_url: str) -> requests.Response:
        """Upload video file to TikTok servers"""
        with open(video_path, 'rb') as video_file:
            headers = {
                "Content-Type": "video/mp4",
                "Content-Range": f"bytes 0-{os.path.getsize(video_path)-1}/{os.path.getsize(video_path)}"
            }
            return requests.put(upload_url, headers=headers, data=video_file)
    
    def _publish_video(self, publish_id: str, caption: str, privacy_level: str) -> Dict[str, Any]:
        """Publish video with metadata"""
        url = f"{self.base_url}/post/publish/"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "publish_id": publish_id,
            "post_info": {
                "title": caption,
                "privacy_level": privacy_level,
                "disable_duet": False,
                "disable_stitch": False,
                "disable_comment": False
            }
        }
        
        response = requests.post(url, headers=headers, json=payload)
        return response.json()
    
    def get_publish_status(self, publish_id: str) -> Dict[str, Any]:
        """
        Check the status of a publish operation
        
        Args:
            publish_id: Publish ID from upload initialization
            
        Returns:
            API response with publish status
        """
        url = f"{self.base_url}/post/publish/status/fetch/"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "publish_id": publish_id
        }
        
        response = requests.post(url, headers=headers, json=payload)
        return response.json()
    
    def wait_for_completion(self, publish_id: str, max_wait_time: int = 300) -> Dict[str, Any]:
        """
        Wait for publish operation to complete
        
        Args:
            publish_id: Publish ID to monitor
            max_wait_time: Maximum time to wait in seconds
            
        Returns:
            Final status response
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status = self.get_publish_status(publish_id)
            
            if "data" in status and "status" in status["data"]:
                current_status = status["data"]["status"]
                print(f"Current status: {current_status}")
                
                if current_status in ["PUBLISH_SUCCESS", "PUBLISH_FAILED"]:
                    return status
            
            time.sleep(10)  # Check every 10 seconds
        
        return {"error": "Timeout waiting for publish completion"}


def main():
    """Example usage of TikTokPoster"""
    
    # TikTok API Credentials (replace with your actual credentials)
    ACCESS_TOKEN = os.getenv("TIKTOK_ACCESS_TOKEN")  # Get from environment variable
    
    if not ACCESS_TOKEN:
        print("Error: TIKTOK_ACCESS_TOKEN environment variable not set")
        print("Please set your TikTok Access Token as an environment variable")
        return
    
    # Initialize the poster
    poster = TikTokPoster(ACCESS_TOKEN)
    
    # Example: Upload video from file
    print("=== Upload Video from File Example ===")
    video_path = "/path/to/your/video.mp4"
    caption = "Check out this amazing video! 🎬 #tiktok #viral #fyp"
    
    if os.path.exists(video_path):
        result = poster.upload_video_from_file(video_path, caption)
        print(f"Result: {json.dumps(result, indent=2)}")
        
        # Wait for completion if we got a publish_id
        if "data" in result and "publish_id" in result["data"]:
            publish_id = result["data"]["publish_id"]
            final_status = poster.wait_for_completion(publish_id)
            print(f"Final Status: {json.dumps(final_status, indent=2)}")
    else:
        print(f"Video file not found: {video_path}")
    
    # Example: Upload video from URL
    print("\n=== Upload Video from URL Example ===")
    video_url = "https://example.com/path/to/video.mp4"
    caption_url = "Amazing content from the web! 🌐 #tiktok #content"
    
    result_url = poster.upload_video_from_url(video_url, caption_url)
    print(f"URL Result: {json.dumps(result_url, indent=2)}")
    
    # Example: Upload photos
    print("\n=== Upload Photos Example ===")
    photo_urls = [
        "https://example.com/path/to/photo1.jpg",
        "https://example.com/path/to/photo2.jpg"
    ]
    title = "My Photo Gallery"
    description = "Check out these amazing photos! 📸 #photography #tiktok"
    
    photo_result = poster.upload_photos(photo_urls, title, description)
    print(f"Photo Result: {json.dumps(photo_result, indent=2)}")


if __name__ == "__main__":
    main()
