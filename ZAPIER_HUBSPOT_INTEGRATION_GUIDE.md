# Zapier-HubSpot Integration Guide

This guide provides a comprehensive, step-by-step process for integrating the OneKeel OfferLogix Swarm platform with HubSpot using Zapier. It is divided into two sections, one for each party involved in the setup.

## For the OneKeel Party (Platform & Zapier Setup)

This section outlines the steps for the OneKeel party to configure the Zapier integration on the platform and set up the Zapier workflow.

### Step 1: Configure Environment Variables

The first step is to configure the environment variables on the server where the OneKeel OfferLogix Swarm platform is deployed. These variables control the Zapier integration.

1.  **Access the Server Environment**: Log in to the server or deployment platform (e.g., Render, AWS, etc.) where the application is hosted.

2.  **Set the Environment Variables**: Add the following environment variables to your application's configuration:

    *   `ZAPIER_INTEGRATION_ENABLED`: Set this to `true` to enable the integration.
    *   `ZAPIER_WEBHOOK_URL`: You will get this URL from Zapier in the next step. Leave it blank for now.
    *   `ZAPIER_SECRET_KEY`: (Optional but recommended) Generate a secure, random string to use as a secret key for verifying webhook requests. You will need to provide this key to Zapier.

### Step 2: Create a New Zap in Zapier

Now, you will create a new Zap in your Zapier account to receive data from the OneKeel platform.

1.  **Log in to Zapier**: Go to [zapier.com](https://zapier.com) and log in to your account.

2.  **Create a New Zap**: Click the "Create Zap" button.

3.  **Choose the Trigger**: Search for and select the "Webhooks by Zapier" app.

4.  **Select the Trigger Event**: Choose the "Catch Hook" event and click "Continue".

5.  **Copy the Webhook URL**: Zapier will provide you with a custom webhook URL. Copy this URL.

### Step 3: Update the Environment Variables

Go back to your server environment and update the `ZAPIER_WEBHOOK_URL` environment variable with the URL you copied from Zapier.

### Step 4: Test the Webhook Trigger

Now you need to send a test request from the OneKeel platform to Zapier to confirm that the connection is working.

1.  **Trigger a Test Event**: You can use the new API endpoint to test the connection. Send a POST request to `/api/integrations/zapier/test` on your application server.

2.  **Verify in Zapier**: Go back to the Zapier editor and click the "Test trigger" button. Zapier should show the test data sent from your application.

### Step 5: Configure the HubSpot Action

Now that you are receiving data from the OneKeel platform, you can configure the action to create or update a contact in HubSpot.

1.  **Choose the Action App**: Search for and select the "HubSpot" app.

2.  **Select the Action Event**: Choose the "Create or Update Contact" action and click "Continue".

3.  **Connect Your HubSpot Account**: If you haven't already, connect your HubSpot account to Zapier.

4.  **Map the Data Fields**: Map the data fields from the Zapier webhook to the corresponding fields in HubSpot. For example:

    *   **Contact Email**: Map this to the `lead.email` field from the webhook data.
    *   **First Name**: Map this to the `lead.firstName` field.
    *   **Last Name**: Map this to the `lead.lastName` field.
    *   **Phone Number**: Map this to the `lead.phoneNumber` field.

5.  **Test the Action**: Send a test to HubSpot to confirm that the contact is created or updated correctly.

6.  **Publish the Zap**: Once you are satisfied with the setup, publish your Zap.

## For the OfferLogix Party (HubSpot Access)

This section outlines the steps for the OfferLogix party to provide the necessary HubSpot access and information to the OneKeel party.

### Step 1: Provide HubSpot API Access

The OneKeel party will need access to your HubSpot account to set up the Zapier integration. You can either provide them with a user account with the necessary permissions or create a private app with the required scopes.

*   **Option 1: User Account**: Create a new user in your HubSpot account with at least the following permissions:
    *   **Contacts**: View and edit contacts.
*   **Option 2: Private App**: Create a private app in your HubSpot developer account with the following scopes:
    *   `crm.objects.contacts.write`
    *   `crm.objects.contacts.read`

### Step 2: Share HubSpot Account Information

Securely share the HubSpot account credentials or the private app access token with the OneKeel party.

### Step 3: Verify the Integration

Once the OneKeel party has set up the integration, you should verify that the data is flowing correctly into your HubSpot account.

1.  **Create a Test Lead**: Ask the OneKeel party to create a test lead in the OneKeel platform.

2.  **Check HubSpot**: Log in to your HubSpot account and search for the test lead's email address. You should see a new contact created or an existing contact updated with the information from the OneKeel platform.

By following these steps, both parties can successfully set up the Zapier-HubSpot integration, enabling a seamless flow of lead data from the OneKeel OfferLogix Swarm platform to HubSpot.


