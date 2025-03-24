"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Download, Loader2, Link as LinkIcon } from "lucide-react"
import { downloadAudio, getFormats } from "@/lib/api"

type FormData = {
  url: string
  format: string
}

interface AudioDownloadFormProps {
  initialUrl?: string;
}

export default function AudioDownloadForm({ initialUrl = '' }: AudioDownloadFormProps) {
  const [formats, setFormats] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const { control, register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      url: initialUrl,
      format: "wav",
    },
  })
  const { toast } = useToast()

  // Update URL field when initialUrl changes
  useEffect(() => {
    if (initialUrl) {
      setValue('url', initialUrl);
    }
  }, [initialUrl, setValue]);

  useEffect(() => {
    getFormats()
      .then((formats) => setFormats(formats))
      .catch((error) =>
        toast({ title: "Error", description: `Failed to fetch formats: ${error}`, variant: "destructive" }),
      )
  }, [toast])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setDownloadUrl(null)

    try {
      const result = await downloadAudio({
        url: data.url,
        format: data.format
      })
      
      setDownloadUrl(result.download_url)
      toast({
        title: "Success",
        description: "Your audio is ready for download.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to process your request. Please try again. ${error}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="url" className="text-sm font-medium">
          YouTube URL
        </Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <LinkIcon size={16} />
          </div>
          <Input 
            id="url" 
            {...register("url", { required: true })} 
            placeholder="https://www.youtube.com/watch?v=..." 
            className="pl-9 h-10 focus:ring-2 focus:ring-primary/20" 
          />
        </div>
        {errors.url && <p className="text-sm text-destructive">YouTube URL is required</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="format" className="text-sm font-medium">
          Audio Format
        </Label>
        <Controller
          name="format"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {formats.map((format) => (
                  <SelectItem key={format} value={format} className="text-sm">
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      
      <div className="pt-2">
        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full h-10 font-medium transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Audio
            </>
          )}
        </Button>
      </div>

      {downloadUrl && (
        <Alert className="mt-6 border-l-4 border-l-primary">
          <AlertTitle className="text-sm font-medium">Download Ready</AlertTitle>
          <AlertDescription className="mt-2 text-sm">
            Your audio is ready.{" "}
            <Link 
              href={downloadUrl} 
              className="font-medium text-primary hover:underline inline-flex items-center"
            >
              Click here to download
              <Download className="ml-1 h-3 w-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </form>
  )
}

