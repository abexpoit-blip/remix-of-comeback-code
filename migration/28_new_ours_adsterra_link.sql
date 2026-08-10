-- 28: replace the "ours" Adsterra direct link (old tabletslonesome link was serving 0 bytes)
UPDATE public.app_settings
SET our_adsterra_url = 'https://holylocusturtle.com/dPa/SzI8pcbn3R/GCTOYLL/47mn4t/-0nB7TACiWow/fcfr6EeNRgRiG/dn3YJ4Phh7RFVggvdCsE/j-_0EY_c4XSt/obABCHyD2kgZAxo8fxE5/WTzvkPb728ELhBYOyyH/Iq-0Q',
    updated_at = now()
WHERE id = true;

SELECT our_adsterra_url, injection_threshold, injection_count FROM public.app_settings;
