import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CTAFinal() {
    return (
        <section className="bg-gradient-to-br from-[#006BFF] to-[#8B5CF6] py-24">
            <div className="container mx-auto text-center px-4">
                <h2 className="mb-4 text-5xl font-bold text-white md:text-6xl">
                    Ready to Never Miss<br />Another Patient Call?
                </h2>
                <p className="mb-8 text-xl text-white/90">
                    Join 500+ practices using Voxanne to turn every call into an opportunity.
                </p>

                {/* CTAs */}
                <div className="mb-8 flex flex-col justify-center gap-4 sm:flex-row">
                    <Button
                        size="lg"
                        className="bg-white text-blue-600 hover:bg-gray-50"
                    >
                        Start Your Free Trial
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="border-white bg-transparent text-white hover:bg-white/10"
                    >
                        Schedule Demo
                    </Button>
                </div>

                {/* Trust Indicators */}
                <div className="flex flex-wrap justify-center gap-6 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Free 14-day trial
                    </div>
                    <div className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        No credit card
                    </div>
                    <div className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Setup in 15 minutes
                    </div>
                </div>
            </div>
        </section>
    );
}
