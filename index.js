import express from "express";
import axios from "axios";

const app = express();

// Hardcoded LinkedIn credentials (replace with your own; secure in production)
const LINKEDIN_CLIENT_ID = "77hcrls6q3cwbc"; // Replace with your LinkedIn app's Client ID
const LINKEDIN_CLIENT_SECRET = "WPL_AP1.1r5SfEpxXXYW5P6y.88nY9Q=="; // Replace with your LinkedIn app's Client Secret
const REDIRECT_URI = "https://post-api-9gwc.onrender.com/linkedin/callback"; // Replace with your redirect URI
const LINKEDIN_ORG_ID = ""; // Optional: Replace with your LinkedIn Company Page ID for organization posts, or leave empty for personal profile

// In-memory storage for access token (use database like Redis/MongoDB in production)
let storedAccessToken = null;

// STEP 1: Redirect user to LinkedIn for authentication
app.get("/linkedin/login", (req, res) => {
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=w_member_social`;

  res.redirect(authUrl);
});

// STEP 2: Handle LinkedIn callback and store access token
app.get("/linkedin/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }

  try {
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    storedAccessToken = tokenRes.data.access_token; // Store token
    console.log("✅ Access Token:", storedAccessToken);

    res.send("Authentication successful! Ready to post jobs to LinkedIn.");
  } catch (error) {
    console.error(
      "❌ Error fetching access token:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to get access token.");
  }
});

// STEP 3: Create job and post to LinkedIn
app.post("/jobs/create", async (req, res) => {
  const { title, description, applyUrl } = req.body;

  // Validate request body
  if (!title || !description || !applyUrl) {
    return res
      .status(400)
      .send(
        "Missing job details: title, description, and applyUrl are required."
      );
  }

  if (!storedAccessToken) {
    return res
      .status(401)
      .send(
        "LinkedIn not authenticated. Please authenticate via /linkedin/login."
      );
  }

  try {
    // Get author URN (use organization URN for Company Page or personal profile)
    let author;
    if (LINKEDIN_ORG_ID) {
      author = `urn:li:organization:${LINKEDIN_ORG_ID}`; // Company Page
    } else {
      const profile = await axios.get("https://api.linkedin.com/v2/me", {
        headers: { Authorization: `Bearer ${storedAccessToken}` },
      });
      author = `urn:li:person:${profile.data.id}`; // Personal profile
    }

    // Post job to LinkedIn
    const postRes = await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      {
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: `🚀 We're hiring: ${title}!\n${description}\nApply now: ${applyUrl}\n#Hiring #JobOpportunity`,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${storedAccessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Posted job to LinkedIn:", postRes.data);
    res.send("✅ Job created and posted to LinkedIn!");
  } catch (error) {
    console.error(
      "❌ Error posting to LinkedIn:",
      error.response?.data || error.message
    );
    res.status(500).send("Failed to post job to LinkedIn.");
  }
});

// Basic route for testing
app.get("/", (req, res) => {
  res.send(
    "Job posting API is running. Use /linkedin/login to authenticate or /jobs/create to post jobs."
  );
});
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
});
