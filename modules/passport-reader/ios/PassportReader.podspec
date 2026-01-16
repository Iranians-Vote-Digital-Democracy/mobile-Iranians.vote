Pod::Spec.new do |s|
  s.name           = 'PassportReader'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for reading NFC-enabled passports'
  s.description    = 'Native module for reading e-Passport data via NFC using the NFCPassportReader library'
  s.author         = 'Iranians.Vote'
  s.homepage       = 'https://github.com/Iranians-Vote-Digital-Democracy/mobile-Iranians.vote'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'NFCPassportReader'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "src/**/*.{h,m,mm,swift,hpp,cpp}"
end
