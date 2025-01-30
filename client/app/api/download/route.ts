import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json()
  const { url, format } = body

  const apiUrl = "https://audiotube-api.geethg.com/download"

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, format }),
    })

    if (!response.ok) {
      throw new Error("API request failed")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: `Failed to process your request: ${error}` }, { status: 400 })
  }
}

