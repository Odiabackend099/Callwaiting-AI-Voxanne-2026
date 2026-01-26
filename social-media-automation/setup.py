#!/usr/bin/env python3
"""
Setup script for Social Media Automation Suite
"""

import os
import subprocess
import sys

def install_requirements():
    """Install required Python packages"""
    print("📦 Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Requirements installed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing requirements: {e}")
        return False
    return True

def setup_environment():
    """Set up environment configuration"""
    print("⚙️  Setting up environment configuration...")
    
    env_file = ".env"
    env_example = ".env.example"
    
    if not os.path.exists(env_file) and os.path.exists(env_example):
        # Copy example to .env
        with open(env_example, 'r') as example_file:
            content = example_file.read()
        
        with open(env_file, 'w') as env_file_write:
            env_file_write.write(content)
        
        print(f"✅ Created {env_file} from {env_example}")
        print("⚠️  Please edit .env file with your actual API credentials")
        return True
    elif os.path.exists(env_file):
        print(f"✅ {env_file} already exists")
        return True
    else:
        print(f"❌ {env_example} not found")
        return False

def setup_voice_recognition():
    """Set up voice recognition (optional)"""
    print("🎤 Setting up voice recognition...")
    
    try:
        import speech_recognition as sr
        print("✅ Speech recognition library is available")
        
        # Test microphone access
        r = sr.Recognizer()
        mic_list = sr.Microphone.list_microphone_names()
        
        if mic_list:
            print(f"✅ Found {len(mic_list)} microphone(s)")
            for i, mic in enumerate(mic_list[:3]):  # Show first 3
                print(f"   {i}: {mic}")
        else:
            print("⚠️  No microphones found")
        
        return True
    except ImportError:
        print("⚠️  Speech recognition not available. Install with: pip install SpeechRecognition pyaudio")
        return False
    except Exception as e:
        print(f"⚠️  Voice recognition setup issue: {e}")
        return False

def create_desktop_shortcut():
    """Create a desktop shortcut for easy access"""
    print("🖥️  Creating desktop shortcut...")
    
    script_path = os.path.abspath("social-media-automation.py")
    
    # Create a simple launcher script
    launcher_content = f"""#!/bin/bash
cd "{os.path.dirname(script_path)}"
python3 "{script_path}" --mode interactive
"""
    
    launcher_path = "run-automation.sh"
    with open(launcher_path, 'w') as f:
        f.write(launcher_content)
    
    # Make it executable
    os.chmod(launcher_path, 0o755)
    
    print(f"✅ Created launcher: {launcher_path}")
    print("   Run it with: ./run-automation.sh")

def main():
    """Main setup function"""
    print("🚀 Social Media Automation Suite Setup")
    print("=" * 50)
    
    success = True
    
    # Step 1: Install requirements
    if not install_requirements():
        success = False
    
    # Step 2: Set up environment
    if not setup_environment():
        success = False
    
    # Step 3: Set up voice recognition (optional)
    setup_voice_recognition()
    
    # Step 4: Create desktop shortcut
    create_desktop_shortcut()
    
    # Final instructions
    print("\n" + "=" * 50)
    if success:
        print("✅ Setup completed successfully!")
        print("\n📋 Next steps:")
        print("1. Edit .env file with your API credentials")
        print("2. For Instagram: Get User Access Token and User ID")
        print("3. For TikTok: Get Access Token")
        print("4. Run: ./run-automation.sh")
        print("5. Or: python3 social-media-automation.py --mode voice")
    else:
        print("❌ Setup completed with errors. Please check the messages above.")
    
    print("\n📚 Usage examples:")
    print("  # Interactive mode")
    print("  python3 social-media-automation.py")
    print("")
    print("  # Voice command mode")
    print("  python3 social-media-automation.py --mode voice")
    print("")
    print("  # Command line - Instagram")
    print('  python3 social-media-automation.py --platform instagram --content-type image --image-url "https://example.com/img.jpg" --caption "Amazing sunset!"')
    print("")
    print("  # Command line - TikTok")
    print('  python3 social-media-automation.py --platform tiktok --content-type video --video-url "https://example.com/video.mp4" --caption "Check this out!"')

if __name__ == "__main__":
    main()
