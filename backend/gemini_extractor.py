import os
import json
import re
from PIL import Image
from google import genai
from google.genai import types


MODEL_NAME = "gemini-3.5-flash-lite"


def structure_receipt_from_image(image_path):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is missing.")

    client = genai.Client(api_key=api_key)

    prompt = """
You are an expert handwritten Indian receipt data extraction system.

Carefully read the uploaded receipt image and return ONLY valid JSON.

Required JSON structure:
{
  "raw_text": "Complete readable text from the receipt",
  "shop_name": "Shop name or null",
  "date": "Date in YYYY-MM-DD format or null",
  "items": [
    {
      "item_name": "Item description",
      "quantity": 1,
      "unit_price": 100.00,
      "amount": 100.00
    }
  ],
  "gst_amount": null,
  "total_amount": null,
  "warnings": []
}

IMPORTANT RULES:
1. Extract only information visible in the receipt.
2. Never invent missing values. Use null when uncertain or unreadable.
3. Extract every identifiable line item.
4. Quantity must be numeric. If quantity has a unit like kg, m or pcs,
   preserve that unit in the item_name.
5. Extract unit price and item amount separately.
6. Convert dates to YYYY-MM-DD wherever possible.
7. Identify the final payable total, not an intermediate subtotal.
8. If multiple conflicting totals appear, add a warning explaining
   the conflict. Do not silently choose a total.
9. GST must be null if no GST amount is explicitly identifiable.
10. Do not mistake phone numbers, addresses or invoice numbers for amounts.
11. Keep the original readable receipt text in raw_text.
12. Return JSON only, without Markdown fences.
"""

    try:
        with Image.open(image_path) as image:
            image = image.convert("RGB")

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=[prompt, image],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )

        if not response.text:
            raise RuntimeError("Gemini returned an empty response.")

        result_text = response.text.strip()
        result_text = re.sub(r"^```(?:json)?\s*", "", result_text)
        result_text = re.sub(r"\s*```$", "", result_text)

        data = json.loads(result_text)

        required_fields = [
            "raw_text",
            "shop_name",
            "date",
            "items",
            "gst_amount",
            "total_amount",
            "warnings"
        ]

        for field in required_fields:
            if field not in data:
                data[field] = [] if field in ("items", "warnings") else None

        if not isinstance(data["items"], list):
            raise ValueError("Invalid items format returned by Gemini.")

        return data

    except Exception as error:
        print("Gemini receipt extraction error:", str(error))
        raise
