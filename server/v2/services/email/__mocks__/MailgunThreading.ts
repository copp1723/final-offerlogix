export class MailgunThreading {
  async sendEmail() { 
    return { 
      messageId: '<mock@fake.test>',
      conversationId: 'mock-conversation-id'
    }; 
  }
}