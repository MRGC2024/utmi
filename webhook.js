const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const UTMFIFY_API_TOKEN = 'J3kUFv4ZLQVQaNTallLP7aOpIw9gAa9FigQQ'; // Sua credencial da Utmify
const UTMFIFY_ENDPOINT = 'https://api.utmify.com.br/api-credentials/orders';

// Rota do webhook
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    // Verifique se o payload contém os dados necessários
    if (!payload || !payload.event) {
      return res.status(400).send('Payload inválido');
    }

    // Mapeie o evento do Skalepay para o status da Utmify
    let status;
    switch (payload.event) {
      case 'payment_created': // Pix gerado
        status = 'waiting_payment';
        break;
      case 'payment_paid': // Pix pago
        status = 'paid';
        break;
      case 'payment_refunded': // Reembolsado
        status = 'refunded';
        break;
      case 'payment_failed': // Falha no pagamento
        status = 'refused';
        break;
      default:
        return res.status(200).send('Evento não mapeado');
    }

    // Prepare os dados para a Utmify
    const utmifyData = {
      orderId: payload.id, // ID do pagamento no Skalepay
      platform: 'Skalepay',
      paymentMethod: payload.payment_method, // Ex: pix, credit_card, boleto
      status: status,
      createdAt: payload.created_at, // Data de criação do pagamento
      approvedDate: status === 'paid' ? payload.paid_at : null, // Data de aprovação
      refundedAt: status === 'refunded' ? payload.refunded_at : null, // Data de reembolso
      customer: {
        name: payload.customer.name,
        email: payload.customer.email,
        phone: payload.customer.phone,
        document: payload.customer.document,
        country: 'BR', // Defina o país se necessário
        ip: payload.customer.ip || null,
      },
      products: [
        {
          id: payload.items[0].id, // ID do produto
          name: payload.items[0].name, // Nome do produto
          planId: null, // ID do plano (se aplicável)
          planName: null, // Nome do plano (se aplicável)
          quantity: payload.items[0].quantity,
          priceInCents: payload.items[0].price * 100, // Preço em centavos
        },
      ],
      trackingParameters: {
        src: null, // Parâmetro src (se aplicável)
        sck: null, // Parâmetro sck (se aplicável)
        utm_source: payload.utm_source || null,
        utm_campaign: payload.utm_campaign || null,
        utm_medium: payload.utm_medium || null,
        utm_content: payload.utm_content || null,
        utm_term: payload.utm_term || null,
      },
      commission: {
        totalPriceInCents: payload.amount * 100, // Valor total em centavos
        gatewayFeeInCents: payload.fee * 100, // Taxa do gateway em centavos
        userCommissionInCents: (payload.amount - payload.fee) * 100, // Comissão do usuário
        currency: 'BRL', // Moeda
      },
      isTest: false, // Defina como true para testes
    };

    // Envie os dados para a Utmify
    const response = await axios.post(UTMFIFY_ENDPOINT, utmifyData, {
      headers: {
        'x-api-token': UTMFIFY_API_TOKEN,
      },
    });

    console.log('Dados enviados para a Utmify:', response.data);
    res.status(200).send('Webhook processado com sucesso');
  } catch (error) {
    console.error('Erro no webhook:', error.message);
    res.status(500).send('Erro ao processar webhook');
  }
});

// Inicie o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook rodando na porta ${PORT}`);
});