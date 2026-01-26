#!/usr/bin/env python3
"""
Instagram Content Automation Script
Posts images, videos, and carousels to Instagram using the Instagram Graph API
"""

import requests
import json
import os
import time
from typing import Optional, Dict, Any

class InstagramPoster:
    def __init__(self, app_id: str, app_secret: str, access_token: str):
        """
        Initialize Instagram poster with API credentials
        
        Args:
            app_id: Instagram App ID
            app_secret: Instagram App Secret  
            access_token: Instagram User Access Token
        """
        self.app_id = app_id
        self.app_secret = app_secret
        self.access_token = access_token
        self.base_url = "https://graph.facebook.com/v18.0"
        
    def create_media_object(self, image_url: str, caption: str, ig_user_id: str, 
                           media_type: str = "IMAGE", alt_text: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a media object for Instagram
        
        Args:
            image_url: Public URL of the image/video
            caption: Caption for the post
            ig_user_id: Instagram User ID
            media_type: IMAGE, VIDEO, or CAROUSEL
            alt_text: Alternative text for accessibility
            
        Returns:
            API response containing media creation ID
        """
        url = f"{self.base_url}/{ig_user_id}/media"
        
        payload = {
            "image_url": image_url,
            "caption": caption,
            "media_type": media_type,
            "access_token": self.access_token
        }
        
        if alt_text:
            payload["alt_text"] = alt_text
            
        response = requests.post(url, data=payload)
        return response.json()
    
    def create_carousel(self, children_ids: list, caption: str, ig_user_id: str) -> Dict[str, Any]:
        """
        Create a carousel post with multiple media items
        
        Args:
            children_ids: List of media object IDs
            caption: Caption for the carousel
            ig_user_id: Instagram User ID
            
        Returns:
            API response containing carousel creation ID
        """
        url = f"{self.base_url}/{ig_user_id}/media"
        
        payload = {
            "media_type": "CAROUSEL",
            "children": ",".join(children_ids),
            "caption": caption,
            "access_token": self.access_token
        }
        
        response = requests.post(url, data=payload)
        return response.json()
    
    def publish_media(self, creation_id: str, ig_user_id: str) -> Dict[str, Any]:
        """
        Publish a created media object
        
        Args:
            creation_id: Media creation ID from create_media_object
            ig_user_id: Instagram User ID
            
        Returns:
            API response with published media ID
        """
        url = f"{self.base_url}/{ig_user_id}/media_publish"
        
        payload = {
            "creation_id": creation_id,
            "access_token": self.access_token
        }
        
        response = requests.post(url, data=payload)
        return response.json()
    
    def get_media_status(self, creation_id: str, ig_user_id: str) -> Dict[str, Any]:
        """
        Check the status of a media object
        
        Args:
            creation_id: Media creation ID
            ig_user_id: Instagram User ID
            
        Returns:
            API response with media status
        """
        url = f"{self.base_url}/{ig_user_id}/media"
        
        params = {
            "fields": "status,code",
            "access_token": self.access_token
        }
        
        response = requests.get(url, params=params)
        return response.json()
    
    def post_single_image(self, image_url: str, caption: str, ig_user_id: str, 
                         alt_text: Optional[str] = None) -> Dict[str, Any]:
        """
        Complete flow to post a single image to Instagram
        
        Args:
            image_url: Public URL of the image
            caption: Caption for the post
            ig_user_id: Instagram User ID
            alt_text: Alternative text for accessibility
            
        Returns:
            Final API response with published media information
        """
        print(f"Creating media object for image: {image_url}")
        
        # Step 1: Create media object
        media_response = self.create_media_object(
            image_url=image_url,
            caption=caption,
            ig_user_id=ig_user_id,
            alt_text=alt_text
        )
        
        if "id" not in media_response:
            print(f"Error creating media object: {media_response}")
            return media_response
        
        creation_id = media_response["id"]
        print(f"Media object created with ID: {creation_id}")
        
        # Step 2: Publish the media
        print("Publishing media...")
        publish_response = self.publish_media(creation_id, ig_user_id)
        
        if "id" in publish_response:
            print(f"Successfully published! Media ID: {publish_response['id']}")
        else:
            print(f"Error publishing: {publish_response}")
        
        return publish_response
    
    def post_carousel(self, image_urls: list, caption: str, ig_user_id: str) -> Dict[str, Any]:
        """
        Complete flow to post a carousel to Instagram
        
        Args:
            image_urls: List of public URLs of images
            caption: Caption for the carousel
            ig_user_id: Instagram User ID
            
        Returns:
            Final API response with published media information
        """
        print(f"Creating carousel with {len(image_urls)} images")
        
        # Step 1: Create media objects for each image
        children_ids = []
        for i, image_url in enumerate(image_urls):
            print(f"Creating media object {i+1}/{len(image_urls)}")
            media_response = self.create_media_object(
                image_url=image_url,
                caption="",  # Carousel caption is set at carousel level
                ig_user_id=ig_user_id
            )
            
            if "id" in media_response:
                children_ids.append(media_response["id"])
                print(f"Media object {i+1} created with ID: {media_response['id']}")
            else:
                print(f"Error creating media object {i+1}: {media_response}")
                return media_response
        
        # Step 2: Create carousel
        print("Creating carousel...")
        carousel_response = self.create_carousel(
            children_ids=children_ids,
            caption=caption,
            ig_user_id=ig_user_id
        )
        
        if "id" not in carousel_response:
            print(f"Error creating carousel: {carousel_response}")
            return carousel_response
        
        carousel_creation_id = carousel_response["id"]
        print(f"Carousel created with ID: {carousel_creation_id}")
        
        # Step 3: Publish the carousel
        print("Publishing carousel...")
        publish_response = self.publish_media(carousel_creation_id, ig_user_id)
        
        if "id" in publish_response:
            print(f"Successfully published carousel! Media ID: {publish_response['id']}")
        else:
            print(f"Error publishing carousel: {publish_response}")
        
        return publish_response


def main():
    """Example usage of InstagramPoster"""
    
    # Instagram API Credentials (replace with your actual credentials)
    APP_ID = "1539700640416618"
    APP_SECRET = "592580e08fb2ad5d0979fac07979db60"
    ACCESS_TOKEN = os.getenv("INSTAGRAM_ACCESS_TOKEN")  # Get from environment variable
    
    if not ACCESS_TOKEN:
        print("Error: INSTAGRAM_ACCESS_TOKEN environment variable not set")
        print("Please set your Instagram User Access Token as an environment variable")
        return
    
    # Instagram User ID (replace with your actual Instagram User ID)
    IG_USER_ID = os.getenv("INSTAGRAM_USER_ID")
    
    if not IG_USER_ID:
        print("Error: INSTAGRAM_USER_ID environment variable not set")
        print("Please set your Instagram User ID as an environment variable")
        return
    
    # Initialize the poster
    poster = InstagramPoster(APP_ID, APP_SECRET, ACCESS_TOKEN)
    
    # Example: Post a single image
    print("=== Posting Single Image Example ===")
    image_url = "https://example.com/path/to/your/image.jpg"
    caption = "Amazing sunset! 🌅 #sunset #nature #photography"
    alt_text = "Beautiful sunset over mountains with orange and pink sky"
    
    result = poster.post_single_image(
        image_url=image_url,
        caption=caption,
        ig_user_id=IG_USER_ID,
        alt_text=alt_text
    )
    
    print(f"Result: {json.dumps(result, indent=2)}")
    
    # Example: Post a carousel
    print("\n=== Posting Carousel Example ===")
    image_urls = [
        "https://example.com/path/to/image1.jpg",
        "https://example.com/path/to/image2.jpg",
        "https://example.com/path/to/image3.jpg"
    ]
    carousel_caption = "My favorite moments from the trip! 📸 #travel #memories"
    
    carousel_result = poster.post_carousel(
        image_urls=image_urls,
        caption=carousel_caption,
        ig_user_id=IG_USER_ID
    )
    
    print(f"Carousel Result: {json.dumps(carousel_result, indent=2)}")


if __name__ == "__main__":
    main()
