import { companyInformation } from '@/const';

const signupUserVerificationSuccessfulTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Verified - ${companyInformation.name}</title>
  <style>
    /* Reset styles for email clients */
    body { margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    img { border: 0; outline: none; text-decoration: none; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; -webkit-font-smoothing: antialiased;">

  <!-- Preheader Text (Shows in inbox preview) -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    Your email has been successfully verified. Welcome to ${companyInformation.name}!
  </div>

  <!-- Main Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F3F4F6; padding: 40px 20px;">
    <tr>
      <td align="center">
        
        <!-- Email Container -->
        <table role="presentation" width="100%" max-width="600px" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 20px; background-color: #FFFFFF; border-bottom: 1px solid #E5E7EB;">
              <h1 style="margin: 0; color: #C8102E; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                ${companyInformation.name.toUpperCase()}
              </h1>
              <p style="margin: 5px 0 0 0; color: #6B7280; font-size: 14px; font-weight: 500;">GERÜSTBAU</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              
              <!-- Success Icon (Optional visual cue) -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: #DEF7EC; border-radius: 50%; padding: 16px;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#03543F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>

              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 700; text-align: center;">
                Verification Successful!
              </h2>
              
              <p style="margin: 0 0 16px 0; color: #4B5563; font-size: 16px; line-height: 24px;">
                Hi {{name}},
              </p>
              
              <p style="margin: 0 0 32px 0; color: #4B5563; font-size: 16px; line-height: 24px;">
                Your email address (<strong>{{email}}</strong>) has been successfully verified. Your account is now fully active and ready to use.
              </p>
              
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 24px 0;" />

              <p style="margin: 0; color: #9CA3AF; font-size: 13px; line-height: 20px;">
                Need help? If you have any questions or require assistance, please contact our support team at <a href="mailto:${companyInformation.email}" style="color: #C8102E; text-decoration: none; font-weight: 600;">${companyInformation.email}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 13px; line-height: 20px;">
                ${companyInformation.legalName}
              </p>
              <p style="margin: 0 0 16px 0; color: #9CA3AF; font-size: 13px; line-height: 20px;">
                ${companyInformation.address || 'Headquarters Address'} <br />
                <a href="tel:${companyInformation.phone}" style="color: #6B7280; text-decoration: none;">${companyInformation.phone}</a> | 
                <a href="${companyInformation.website}" style="color: #6B7280; text-decoration: none;">${companyInformation.website}</a>
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                ${companyInformation.copyright}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`;

export default signupUserVerificationSuccessfulTemplate;
